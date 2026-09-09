# still_issue.md — ChartsOff Residual Issue Report

## Critical / Data-Correctness

### 1. Stale predictions persist for skipped/failed tickers
- **Files:** `src/pipeline.py:71`, `src/storage/supabase_client.py:48-78`
- The new incremental save calls `storage.save_predictions([prediction])` per ticker. The upsert logic loads the existing file and only ever **overwrites** matching tickers — it never **removes** tickers that were skipped (`continue` on empty data in `pipeline.py:35-37`) or that aren't in a partial `--tickers` run.
- Result: `latest_predictions.json` keeps and serves **stale predictions** for any ticker that wasn't updated this run.

## Performance

### 2. Redundant O(N×M) JSON writes in the pipeline
- **Files:** `src/pipeline.py:71`, `src/storage/supabase_client.py:82-95`
- `save_predictions([prediction])` runs once per ticker (~45×). Every call rewrites `latest_predictions.json` **plus** 3 frontend copies (public/dist/android assets) — roughly **45×4 ≈ 180 full writes** of a ~1.1MB file — then a final `save_predictions(all_predictions)` rewrites everything again. A single final write would suffice.

## Functional Regressions (uncommitted changes)

### 3. NewsFeed auto-refresh polling removed
- **File:** `frontend/src/components/NewsFeed.jsx` (uncommitted diff)
- The 3-minute interval driving the "Automated Real-Time Article Renewing Engine" was deleted. Live news now only refreshes when the selected ticker changes; headlines go stale during an active session.

## ML / Config Inconsistency

### 4. Dead / contradicted prediction horizon config
- **Files:** `src/ml/custom_trainer.py:507,214-219`, `src/config.py:30`, `src/ml/base.py:16`
- `target_horizon_days=20` is hardcoded and training uses 20-bar forward returns, but `config.PREDICTION_HORIZON_DAYS = 5` and the `PredictionResult.target_horizon_days=5` default are unused. Internally the ML is consistent (20d), but the config is misleading dead code.

## Minor / Defensive

### 5. `ffill` before news columns weakens the no-leakage guard
- **File:** `src/features/technical.py:76` (applied before news columns added in `custom_trainer.py:100-109`)
- `res.ffill(inplace=True)` fills rolling-window NaNs on the full frame, so the walk-forward `dropna(subset=feature_columns)` guard rarely drops early rows. The `test_no_bfill_data_leakage` test only checks `compute_all_indicators` in isolation, so it doesn't catch this at the pipeline level.

### 6. MACD status mislabeled at zero
- **File:** `src/ml/custom_trainer.py:434` — `macd_hist <= 0` is always labeled "Dead Cross", including when it's exactly 0.

### 7. Misleading model artifact save
- **File:** `src/pipeline.py:82` — `'ml_model' in locals()` saves the **last** ticker's per-ticker weights as `latest_model.joblib` (a single stock's model labeled as "the model"). Nothing ever loads it, so it's harmless but misleading dead code.

---

# Antigravity Review & Verification Analysis

Below is the verified code-level analysis and expert opinion on each issue raised by Big Pickle:

| # | Issue | Verdict | Severity | Key Impact |
|---|---|---|---|---|
| 1 | Stale predictions persist for skipped/failed tickers | **VALID** | **High** | Data Integrity: Stale predictions and signals remain in production JSON indefinitely. |
| 2 | Redundant O(N×M) JSON writes in pipeline | **VALID** | **High** | Performance: ~204 disk writes of ~1.1MB JSON per pipeline run. |
| 3 | NewsFeed auto-refresh polling removed | **VALID** | **Medium** | UX: News headlines remain static until ticker change or manual reload. |
| 4 | Dead / contradicted prediction horizon config | **VALID** | **Medium** | Consistency: `config.py` specifies 5 days, but ML actually trains and predicts 20 days. |
| 5 | `ffill` weakens no-leakage guard | **PARTIALLY VALID** | **Low-Medium** | Methodological: No future lookahead leakage, but masks rolling NaNs & warmup rows. |
| 6 | MACD status mislabeled at zero | **VALID** | **Low** | Semantic: Polarity check labeled as "Cross", zero defaults to Dead Cross. |
| 7 | Misleading model artifact save | **VALID** | **Low** | Dead Code: Saves only the last ticker's model; never loaded anywhere. |

---

### Detailed Analysis & Opinions

#### 1. Stale predictions persist for skipped/failed tickers
- **Verdict:** **VALID (Confirmed)**
- **Code Reference:** `src/pipeline.py:35-37, 69-74` & `src/storage/supabase_client.py:48-78`
- **Mechanism:** `supabase_client.py` loads existing entries into `existing_map` and only updates keys present in the incoming `results_dict`. If a ticker download fails (line 35 `if ohlcv_df.empty: continue`), or if someone runs `python -m src.pipeline --tickers BBCA.JK`, all other tickers in `latest_predictions.json` remain untouched with their old timestamps, outdated signals, and stale price targets.
- **Opinion & Recommendation:**
  - Upsert is good for single-ticker additions, but for standard batch runs, `latest_predictions.json` should represent the current state of the market.
  - **Recommended fix:** In a full batch run (when `--tickers` is omitted or contains all defaults), replace the batch or prune predictions whose timestamps are older than 24–48 hours. Alternatively, add a `last_updated_run` timestamp and filter out stale tickers in frontend display.

---

#### 2. Redundant O(N×M) JSON writes in the pipeline
- **Verdict:** **VALID (Confirmed)**
- **Code Reference:** `src/pipeline.py:71, 76` & `src/storage/supabase_client.py:82-94`
- **Mechanism:** Inside `for ticker in tickers:` (default 50 tickers), `storage.save_predictions([prediction])` is called on every iteration (line 71). Inside `save_predictions()`, lines 82–94 write the full updated array to **4 distinct file destinations** (`outputs/`, `frontend/public/`, `frontend/dist/`, and `android/app/src/main/assets/...`). Then line 76 runs `storage.save_predictions(all_predictions)` again.
  - Total writes: $4 \times (50 + 1) = \mathbf{204}$ disk writes of an indent-formatted ~1.1MB file per pipeline run.
- **Opinion & Recommendation:**
  - Writing to the 3 frontend asset folders during intermediate ticker processing is completely wasteful and strains GitHub Actions runner I/O and local disks.
  - **Recommended fix:** If crash-recovery is needed during long runs, write only to a temporary local cache or `outputs/latest_predictions.json`. Copying to the 3 frontend directories should happen **strictly once** after the loop completes in line 76.

---

#### 3. NewsFeed auto-refresh polling removed
- **Verdict:** **VALID (Confirmed)**
- **Code Reference:** `frontend/src/components/NewsFeed.jsx:105-140`
- **Mechanism:** The 3-minute polling interval was removed. `useRef` remains imported on line 1 but is unused. News only updates when `ticker` changes (line 139) or when the user manually clicks "Live Update" (line 176).
- **Opinion & Recommendation:**
  - Indonesian financial RSS feeds don't publish new articles every minute, so removing aggressive polling saves network bandwidth.
  - **However**, completely eliminating background refresh means a user monitoring a stock during trading hours will see static news indefinitely.
  - **Recommended fix:** Add a gentle 5-minute interval in `NewsFeed.jsx` that only ticks when `document.visibilityState === "visible"`, mirroring the lifecycle-aware polling in `usePredictions.js`.

---

#### 4. Dead / contradicted prediction horizon config
- **Verdict:** **VALID (Confirmed)**
- **Code Reference:** `src/config.py:30`, `src/ml/base.py:16`, `src/ml/custom_trainer.py:215, 507`
- **Mechanism:** `config.PREDICTION_HORIZON_DAYS = 5` and `PredictionResult.target_horizon_days = 5` are defined, but `custom_trainer.py:215` hardcodes `forward_return = close.pct_change(20).shift(-20)` and line 507 hardcodes `target_horizon_days=20`. The config variable is completely ignored.
- **Opinion & Recommendation:**
  - A 20-trading-day horizon (~1 calendar month) is very different from a 5-day horizon (1 trading week). Discrepancy between code comments/configs and the actual model output causes confusion.
  - **Recommended fix:** Change `config.py` to `PREDICTION_HORIZON_DAYS = 20` (or wire `config.PREDICTION_HORIZON_DAYS` into `custom_trainer.py`'s `pct_change()` and return payload).

---

#### 5. `ffill` before news columns weakens the no-leakage guard
- **Verdict:** **PARTIALLY VALID (Nuanced)**
- **Code Reference:** `src/features/technical.py:76` & `src/ml/custom_trainer.py:89, 123`
- **Mechanism:** `res.ffill(inplace=True)` runs in `TechnicalFeatureEngine` before news features are added. Because `sma_50` uses `min_periods=10` and `sma_200` uses `min_periods=20`, valid values appear by bar 19. Forward-fill carries these values forward across any intermediate NaN gaps.
- **Opinion & Recommendation:**
  - **Does this cause lookahead data leakage?** No. `ffill` only carries past information forward; it does not leak future data (unlike `bfill`). Big Pickle correctly notes that `test_no_bfill_data_leakage` checks only `iloc[0]` and not pipeline-level behaviour.
  - **The real risk:** `ffill` can artificially mask legitimate missing market data gaps and shortens the warm-up drop window in `df.dropna(subset=self.feature_columns)`.
  - **Recommended fix:** Replace `res.ffill(inplace=True)` with explicit warmup dropping (e.g. drop the first 50 bars) or forward-fill only specific continuous series (e.g. macro benchmark alignment), rather than calling a blanket `ffill` on all computed indicators.

---

#### 6. MACD status mislabeled at zero
- **Verdict:** **VALID (Confirmed, Minor)**
- **Code Reference:** `src/ml/custom_trainer.py:434`
- **Mechanism:** `macd_status = "Golden Cross (Positif)" if macd_hist > 0 else "Dead Cross (Tekanan Jual)"`.
- **Opinion & Recommendation:**
  - When `macd_hist == 0.0`, it labels it as "Dead Cross (Tekanan Jual)".
  - More importantly, evaluating `macd_hist > 0` measures current momentum sign/polarity, not a "Cross". A true Golden/Dead Cross is an event that occurs when `macd_hist` transitions from negative to positive (or vice versa) between $t-1$ and $t$.
  - **Recommended fix:**
    ```python
    if macd_hist > 0:
        macd_status = "Momentum Bullish"
    elif macd_hist < 0:
        macd_status = "Momentum Bearish"
    else:
        macd_status = "Netral"
    ```

---

#### 7. Misleading model artifact save
- **Verdict:** **VALID (Confirmed)**
- **Code Reference:** `src/pipeline.py:82-85`
- **Mechanism:** In `src/pipeline.py`, `ml_model = CustomStockMLModel()` is created inside `for ticker in tickers:`. When the loop finishes, `ml_model` points to the last ticker processed (e.g. `UNTR.JK`). Line 84 saves this single stock's weights to `outputs/models/latest_model.joblib`. Nothing in production ever loads or uses this file.
- **Opinion & Recommendation:**
  - The pipeline uses per-ticker walk-forward training/prediction. Saving a single ticker's model as `latest_model.joblib` with the comment "for faster warm-start next run" is completely misleading and non-functional.
  - **Recommended fix:** Either save models per ticker (`models/{ticker}_model.joblib`) if warm-starting is implemented, or remove lines 79–88 entirely to eliminate confusing dead code.

