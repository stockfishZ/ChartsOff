# ChartsOff — Revision Implementation Plan

> **Purpose:** Self-contained instructions for an AI model to execute all fixes and improvements on the ChartsOff stock prediction project.
> **Created:** 2026-09-05 by code review session.
> **Project Root:** `C:\Project\ChartsOff`

---

## 📁 Project Structure Reference

```
ChartsOff/
├── .github/workflows/
│   ├── daily_pipeline.yml          # Cron pipeline (Mon-Fri 16:30 WIB)
│   └── build_apk.yml              # Android APK builder
├── src/
│   ├── __init__.py
│   ├── api.py                     # FastAPI REST endpoints (143 lines)
│   ├── config.py                  # AppConfig with Pydantic (40 lines)
│   ├── pipeline.py                # Main orchestrator (81 lines)
│   ├── data/
│   │   ├── market_feed.py         # yfinance OHLCV fetcher (71 lines)
│   │   ├── news_feed.py           # RSS news + thumbnails (539 lines)
│   │   ├── fundamental_feed.py    # yfinance fundamentals + cache (193 lines)
│   │   └── macro_feed.py          # Macro benchmarks (IHSG, USD/IDR)
│   ├── features/
│   │   ├── technical.py           # 27 technical indicators (78 lines)
│   │   ├── sentiment.py           # NLP sentiment with negation (196 lines)
│   │   ├── institutional_flow.py  # CMF, MFI, smart money (109 lines)
│   │   └── macro.py               # Macro feature alignment
│   ├── ml/
│   │   ├── base.py                # Abstract BaseStockModel + PredictionResult schema (79 lines)
│   │   ├── custom_trainer.py      # AdaptiveBrokerWalkForwardModel (465 lines) ← MAIN ML
│   │   └── precision_action_engine.py  # URGENT_SELL / PRIME_BUY detector (254 lines)
│   └── storage/
│       └── supabase_client.py     # Supabase + local JSON export (76 lines)
├── frontend/
│   ├── capacitor.config.json      # Capacitor Android config
│   ├── package.json               # React 19, Tailwind v4, Capacitor 8, Recharts
│   ├── vite.config.js             # Vite 8 + dev proxy to localhost:8000
│   ├── android/                   # Full Gradle Android project (auto-generated)
│   └── src/
│       ├── App.jsx                # Main app (810 lines) ← MONOLITH TO REFACTOR
│       ├── App.css
│       ├── main.jsx
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── TickerList.jsx
│       │   ├── PredictionCard.jsx
│       │   ├── StockChart.jsx
│       │   ├── KeyFactors.jsx
│       │   ├── NewsFeed.jsx
│       │   ├── PortfolioModal.jsx
│       │   ├── HowItWorksModal.jsx
│       │   ├── NotificationCenterModal.jsx
│       │   ├── BottomNav.jsx
│       │   └── HoldingIcon.jsx
│       ├── data/
│       │   └── idx_companies.js
│       └── services/
│           ├── notificationService.js  # Native Android + Web notifications (364 lines)
│           └── holidayService.js       # IDX holiday calendar sync
├── tests/
│   └── test_pipeline.py           # 6 test functions (168 lines)
├── outputs/
│   ├── latest_predictions.json    # Daily ML output (~1.1MB, 45+ stocks)
│   └── fundamentals_cache.json    # Cached financial ratios (7-day TTL)
├── requirements.txt               # Python deps (missing fastapi/uvicorn)
└── vercel.json                    # Vercel SPA deployment
```

**Tech Stack:**
- **Backend:** Python 3.11, FastAPI, scikit-learn (GradientBoosting), pandas, yfinance, feedparser
- **Frontend:** React 19, Tailwind CSS v4, Vite 8, Recharts, Lucide React
- **Mobile:** Capacitor 8 (WebView-based Android app)
- **CI/CD:** GitHub Actions (daily ML cron + APK build on push)
- **Data:** Zero-cost — yfinance (free), RSS feeds (free), GitHub CDN (free), Supabase (optional free tier)

**Architecture Pattern:** The ML pipeline runs server-side via GitHub Actions cron, commits `outputs/latest_predictions.json` to the repo. The frontend (web + Android) fetches predictions from GitHub Raw CDN. No backend server needed in production.

---

## Phase 1: Critical Fixes (Do These First)

### Task 1.1 — Fix Data Leakage from `bfill` in Technical Indicators

**File:** `src/features/technical.py` lines 74-75
**Problem:** `bfill()` (backward fill) fills NaN values from rolling windows using future data. The walk-forward backtest in `custom_trainer.py` then trains on these rows, inflating the reported win rate with look-ahead bias.

**Current code (lines 73-77):**
```python
        # Clean NaN rows resulting from rolling windows
        res.bfill(inplace=True)
        res.ffill(inplace=True)
        
        return res
```

**Replace with:**
```python
        # Forward-fill only to prevent look-ahead bias in walk-forward simulation.
        # The first ~50 rows will have NaN from rolling windows — these are handled
        # downstream by dropping NaN before training or by min_train_bars guard.
        res.ffill(inplace=True)
        
        return res
```

**Then update** `src/ml/custom_trainer.py` to handle NaN rows. In the `train()` method around line 200, after `features_df = X[self.feature_columns].copy()`, add:

```python
        features_df = X[self.feature_columns].copy()
        
        # Drop rows where rolling window indicators haven't fully populated yet
        features_df = features_df.dropna()
        if len(features_df) < 30:
            return {"status": "insufficient_data"}
```

And in `walk_forward_blind_simulation()` around line 117, add at the start:
```python
        # Drop NaN rows from incomplete rolling windows before simulation
        df = df.dropna(subset=self.feature_columns).copy()
        total_rows = len(df)
```

---

### Task 1.2 — Fix Shared ML Model Instance in API

**File:** `src/api.py` lines 30-33
**Problem:** `ml_model = CustomStockMLModel()` is a module-level singleton. Every `/api/predict/{ticker}` request reuses the same model, causing the scaler state and `is_trained` flag from one ticker to bleed into the next ticker's prediction.

**Current code (lines 30-33):**
```python
market_feed = MarketDataFeed(historical_days=config.HISTORICAL_DAYS)
news_feed = NewsDataFeed(lookback_days=config.NEWS_LOOKBACK_DAYS)
ml_model = CustomStockMLModel()
storage = StorageManager()
```

**Replace with:**
```python
market_feed = MarketDataFeed(historical_days=config.HISTORICAL_DAYS)
news_feed = NewsDataFeed(lookback_days=config.NEWS_LOOKBACK_DAYS)
storage = StorageManager()
```

(Remove the `ml_model` global entirely.)

**Then update** `compute_prediction_for_ticker()` (lines 35-63) to create a fresh model per call:

**Current code (lines 35-63):**
```python
def compute_prediction_for_ticker(ticker: str) -> PredictionResult:
    clean_ticker = ticker.upper().strip()
    if not clean_ticker.endswith(".JK"):
        clean_ticker += ".JK"

    # 1. Fetch price action
    ohlcv_df = market_feed.fetch_historical_ohlcv(clean_ticker)
    if ohlcv_df.empty:
        raise HTTPException(status_code=404, detail=f"Data saham {clean_ticker} tidak ditemukan di Bursa Efek Indonesia.")

    quote = market_feed.fetch_current_quote(clean_ticker)
    current_price = quote.get("current_price") or float(ohlcv_df["Close"].iloc[-1])

    # 2. Fetch news & sentiment
    news_df = news_feed.fetch_news_for_ticker(clean_ticker)
    news_summary = SentimentFeatureEngine.aggregate_news_sentiment(news_df, clean_ticker)

    # 3. Features & ML inference
    features_df = ml_model.prepare_features(ohlcv_df, news_summary)
    
    # Fast training fit
    ml_model.train(features_df)
    
    prediction = ml_model.predict(
        X_latest=features_df,
        current_price=current_price,
        news_summary=news_summary
    )
    return prediction
```

**Replace with:**
```python
def compute_prediction_for_ticker(ticker: str) -> PredictionResult:
    clean_ticker = ticker.upper().strip()
    if not clean_ticker.endswith(".JK"):
        clean_ticker += ".JK"

    # 1. Fetch price action
    ohlcv_df = market_feed.fetch_historical_ohlcv(clean_ticker)
    if ohlcv_df.empty:
        raise HTTPException(status_code=404, detail=f"Data saham {clean_ticker} tidak ditemukan di Bursa Efek Indonesia.")

    quote = market_feed.fetch_current_quote(clean_ticker)
    current_price = quote.get("current_price") or float(ohlcv_df["Close"].iloc[-1])

    # 2. Fetch news & sentiment
    news_df = news_feed.fetch_news_for_ticker(clean_ticker)
    news_summary = SentimentFeatureEngine.aggregate_news_sentiment(news_df, clean_ticker)

    # 3. Fresh model per request to prevent cross-ticker state contamination
    ml_model = CustomStockMLModel()

    # 4. Fetch macro context
    from src.data.macro_feed import MacroDataFeed
    macro_feed = MacroDataFeed()
    macro_df = macro_feed.fetch_macro_benchmarks()

    # 5. Features & ML inference (with macro data)
    features_df = ml_model.prepare_features(ohlcv_df, news_summary, macro_df=macro_df)
    
    # Fast training fit
    ml_model.train(features_df)
    
    prediction = ml_model.predict(
        X_latest=features_df,
        current_price=current_price,
        news_summary=news_summary
    )
    return prediction
```

---

### Task 1.3 — Fix `requirements.txt` (Add Missing, Remove Unused)

**File:** `requirements.txt`

**Replace the entire file with:**
```txt
# Data Ingestion & Manipulation
pandas>=2.2.0
numpy>=1.26.0
yfinance>=0.2.40
requests>=2.31.0
beautifulsoup4>=4.12.0
feedparser>=6.0.11

# Technical Analysis & Mathematics
scipy>=1.12.0

# Machine Learning Foundations
scikit-learn>=1.4.0
joblib>=1.3.0

# API Server
fastapi>=0.115.0
uvicorn>=0.34.0

# Database & Storage (Free Tier Integration)
supabase>=2.4.0
python-dotenv>=1.0.1
pydantic>=2.6.0

# Testing & Execution
pytest>=8.0.0
```

**What changed:**
- **Added:** `fastapi>=0.115.0` and `uvicorn>=0.34.0` (required by `src/api.py`)
- **Removed:** `ta>=0.11.0` (never imported — all indicators computed manually in `technical.py`)
- **Removed:** `nltk>=3.8.1` (never imported — sentiment uses custom keyword engine in `sentiment.py`)
- **Kept:** `scipy` (verify with `grep -r "scipy" src/` — if zero results, remove it too)

---

### Task 1.4 — Fix `prepare_features()` Signature Mismatch

**File:** `src/ml/base.py` line 39
**Problem:** The abstract base class defines `prepare_features(ohlcv_df, news_summary)` but the implementation in `custom_trainer.py` takes an additional `macro_df` parameter. The API (`api.py:53`) calls it without `macro_df`, so the API path never computes macro features.

**Update the base class signature.** In `src/ml/base.py`, change lines 38-43:

**From:**
```python
    @abstractmethod
    def prepare_features(self, ohlcv_df: pd.DataFrame, news_summary: dict | None = None) -> pd.DataFrame:
```

**To:**
```python
    @abstractmethod
    def prepare_features(self, ohlcv_df: pd.DataFrame, news_summary: dict | None = None, macro_df: pd.DataFrame | None = None) -> pd.DataFrame:
```

> The API-side fix (passing macro_df) is already included in Task 1.2 above.

---

## Phase 2: Moderate Improvements

### Task 2.1 — Reduce Polling Interval (60s → 30min)

**File:** `frontend/src/App.jsx` lines 327-334

**Current code:**
```javascript
  useEffect(() => {
    fetchPredictions();
    // Recurring cloud auto-sync every 60 seconds (1 minute) while the app is active
    const interval = setInterval(() => {
      fetchPredictions();
    }, 60000);
    return () => clearInterval(interval);
  }, []);
```

**Replace with:**
```javascript
  useEffect(() => {
    fetchPredictions();
    // Sync every 30 minutes — data only updates once daily after market close.
    // Foreground resume sync is already handled by initLifecycle() above.
    const interval = setInterval(() => {
      fetchPredictions();
    }, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, []);
```

---

### Task 2.2 — Add Model Persistence to Pipeline

**File:** `src/pipeline.py`

After the storage save (line 64), add model saving before the print summary (line 67):

```python
    # 7. Persist trained model artifacts for faster warm-start next run
    model_dir = config.LOCAL_OUTPUT_DIR / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    if all_predictions:
        try:
            ml_model.save(str(model_dir / "latest_model.joblib"))
            logger.info(f"Saved model artifacts to {model_dir / 'latest_model.joblib'}")
        except Exception as e:
            logger.warning(f"Could not save model: {e}")
```

Also add `outputs/models/` to root `.gitignore`:
```gitignore
# Model artifacts
outputs/models/
```

---

### Task 2.3 — Extract App.jsx into Custom Hooks

**File:** `frontend/src/App.jsx` (810 lines → split into hooks)

Create directory `frontend/src/hooks/` and create 4 new files:

#### `frontend/src/hooks/usePredictions.js`
Extract from App.jsx: the `determineDefaultTicker` function (lines 18-47), prediction state (lines 50-68), `fetchPredictions` (lines 253-325), `handleAddCustomTicker` (lines 366-405), `sortedPredictions` useMemo (lines 411-449), live quote useEffect (lines 337-364), and polling useEffect (lines 327-334).

**Exports:** `{ predictions, setPredictions, selectedTicker, setSelectedTicker, loading, isRefreshing, isAddingTicker, errorMessage, fetchPredictions, handleAddCustomTicker, sortedPredictions }`

#### `frontend/src/hooks/usePortfolio.js`
Extract: portfolio state (lines 76-83), `savePortfolioHolding` (lines 198-225), `deletePortfolioHolding` (lines 227-236).

**Exports:** `{ portfolio, savePortfolioHolding, deletePortfolioHolding }`

#### `frontend/src/hooks/useFavorites.js`
Extract: favorites state (lines 86-93), `toggleFavorite` (lines 238-251).

**Exports:** `{ favorites, toggleFavorite }`

#### `frontend/src/hooks/useNotifications.js`
Extract: notification state (lines 109-114), notification evaluation useEffect (lines 180-186), `handleClearAllNotifications` (lines 188-191), `handleMarkAllNotificationsAsRead` (lines 193-196), lifecycle init useEffect (lines 117-150).

**Exports:** `{ notifications, unreadNotifCount, isNotifModalOpen, setIsNotifModalOpen, handleClearAllNotifications, handleMarkAllNotificationsAsRead }`

**Result:** `App.jsx` shrinks to ~300 lines (just JSX rendering + hook wiring).

---

## Phase 3: New Features

### Task 3.1 — Portfolio P&L Dashboard Tab

**Goal:** Add a "Portofolio" tab showing aggregate portfolio value, daily P&L, and per-stock unrealized gains.

**Create:** `frontend/src/components/PortfolioDashboard.jsx`

**Props:** `{ predictions, portfolio, onOpenPortfolioModal, onSelectStock }`

**Logic:**
- Read `portfolio` (contains `buyPrice`, `shares`, `buyDate` per ticker key)
- Match each held ticker with `predictions` for `current_price`
- Calculate per-stock: `unrealized_pnl = (current_price - buyPrice) * shares`
- Calculate per-stock: `pnl_pct = ((current_price - buyPrice) / buyPrice) * 100`
- Calculate aggregate: `total_value = Σ(current_price * shares)`, `total_cost = Σ(buyPrice * shares)`, `total_pnl = total_value - total_cost`

**UI (follow existing design language):**
- Summary card at top: total value, total P&L (Rp + %), color-coded green/red
- Per-stock rows: ticker, company name, shares, avg buy price, current price, P&L amount, P&L %
- Click row → navigate to stock detail (call `onSelectStock(ticker)`)
- Empty state when no holdings: "Belum ada saham di portofolio. Ketuk ikon [holding icon] pada halaman saham untuk mencatat pembelian."

**Design tokens (match existing):**
- Background: `bg-[#F8F7F4]`, Card: `bg-white border border-[#121316] shadow-xs`
- Green (profit): `text-[#1B5E20]` / `bg-[#E8F5E9]`
- Red (loss): `text-[#B71C1C]` / `bg-[#FFEBEE]`
- Font: `font-mono` / `font-mono-num` for numbers, `font-editorial` for headings
- Use `formatRupiah()` from `TickerList.jsx` for price formatting

**Integration:** Add `"portfolio"` as an `activeTab` option in `App.jsx`. Add a tab button in `Header.jsx` or `BottomNav.jsx`.

---

### Task 3.2 — ML Feature Importance in key_factors

**File:** `src/ml/custom_trainer.py`, inside `predict()` method, around line 400.

**Add this block BEFORE the existing `key_factors` list construction (line 400):**

```python
        # Data-driven feature importance from trained GradientBoosting
        feature_importance_factors = []
        if self.is_trained and hasattr(self.classifier, "feature_importances_"):
            importances = self.classifier.feature_importances_
            feature_importance_pairs = sorted(
                zip(self.feature_columns, importances),
                key=lambda x: x[1],
                reverse=True
            )
            FEATURE_LABELS = {
                "ma_trend_bullish": "Tren Moving Average",
                "ema_9": "EMA 9 Hari",
                "ema_21": "EMA 21 Hari",
                "sma_50": "SMA 50 Hari",
                "rsi_14": "RSI 14 Hari",
                "macd": "Indikator MACD",
                "macd_hist": "Momentum MACD",
                "bb_pct_b": "Posisi Bollinger Band",
                "bb_width": "Lebar Bollinger Band",
                "volatility_pct": "Volatilitas Harga",
                "volume_ratio": "Rasio Volume Perdagangan",
                "roc_5": "Momentum 5 Hari",
                "roc_20": "Momentum 20 Hari",
                "cmf_20": "Arus Dana Institusi (CMF)",
                "mfi_14": "Money Flow Index",
                "smart_money_flow_score": "Smart Money Flow Score",
                "ihsg_roc_5": "Momentum IHSG 5 Hari",
                "usdidr_roc_5": "Pergerakan USD/IDR",
                "beta_ihsg_30": "Beta terhadap IHSG",
                "news_avg_sentiment": "Sentimen Berita",
                "news_count": "Jumlah Berita",
            }
            for col_name, importance in feature_importance_pairs[:3]:
                label = FEATURE_LABELS.get(col_name, col_name)
                feature_importance_factors.append({
                    "factor": f"🔑 {label}",
                    "value": f"Pengaruh {importance * 100:.1f}%",
                    "status": "Faktor Kunci Model ML"
                })
```

**Then prepend to existing key_factors (line 400):**
```python
        key_factors = feature_importance_factors + [
            {"factor": "RSI 14 Hari", "value": round(rsi, 2), "status": rsi_status},
            # ... rest of existing factors unchanged ...
        ]
```

---

### Task 3.3 — Sector Heatmap Component

**Create:** `frontend/src/components/SectorHeatmap.jsx`

**Data source:** The sector mapping already exists in `src/data/news_feed.py` lines 78-91 (`TICKER_SECTORS` dict). Duplicate it as a JS constant in the frontend.

**Props:** `{ predictions }`

**Logic:**
```javascript
const SECTOR_MAP = {
  "BBCA.JK": "Perbankan", "BBRI.JK": "Perbankan", "BMRI.JK": "Perbankan", "BBNI.JK": "Perbankan",
  "BRIS.JK": "Perbankan", "BBTN.JK": "Perbankan", "ARTO.JK": "Perbankan", "BDMN.JK": "Perbankan",
  "TLKM.JK": "Telekomunikasi", "ISAT.JK": "Telekomunikasi", "EXCL.JK": "Telekomunikasi",
  "GOTO.JK": "Teknologi", "BUKA.JK": "Teknologi", "EMTK.JK": "Teknologi",
  "ADRO.JK": "Energi", "PTBA.JK": "Energi", "ITMG.JK": "Energi", "MEDC.JK": "Energi", "PGAS.JK": "Energi", "AKRA.JK": "Energi", "BUMI.JK": "Energi",
  "ANTM.JK": "Tambang", "INCO.JK": "Tambang", "MDKA.JK": "Tambang", "AMMN.JK": "Tambang", "BRPT.JK": "Tambang", "TPIA.JK": "Tambang",
  "ICBP.JK": "Konsumsi", "INDF.JK": "Konsumsi", "UNVR.JK": "Konsumsi", "MYOR.JK": "Konsumsi", "CPIN.JK": "Konsumsi", "JPFA.JK": "Konsumsi", "GGRM.JK": "Konsumsi", "HMSP.JK": "Konsumsi",
  "KLBF.JK": "Kesehatan", "SIDO.JK": "Kesehatan",
  "AMRT.JK": "Ritel", "MAPI.JK": "Ritel", "ACES.JK": "Ritel",
  "ASII.JK": "Otomotif", "UNTR.JK": "Otomotif", "AUTO.JK": "Otomotif",
  "SMGR.JK": "Industri", "INTP.JK": "Industri",
  "CTRA.JK": "Properti", "BSDE.JK": "Properti", "PWON.JK": "Properti", "SMRA.JK": "Properti",
  "JSMR.JK": "Infrastruktur",
};
// Group predictions by sector, compute avg expected_return_pct per sector
// Render as responsive grid of colored cards
```

**UI:** Grid of sector cards. Each card shows sector name, stock count, average expected return (color-coded green/red/neutral). Place above the stock list in the "Daftar Saham" tab.

---

### Task 3.4 — Price Target Alert Notifications

**File:** `frontend/src/services/notificationService.js`

**Add a new SCENARIO 5** inside `evaluateAndSendNotifications()`, after the existing SCENARIO 4 block (after line 289, before the `// Persist sent hashes` section):

```javascript
      // =======================================================================
      // SCENARIO 5: PRICE TARGET HIT (Stop-Loss or Take-Profit on Holdings)
      // =======================================================================
      if (isHolding && pred.risk_management) {
        const sl = pred.risk_management.stop_loss_price;
        const tp = pred.risk_management.take_profit_price;
        const price = pred.current_price;

        if (sl && price <= sl) {
          const hash = `SL_HIT_${ticker}_${Math.round(sl)}`;
          if (!sentHashes[hash] || (now - sentHashes[hash]) > COOLDOWN_MS) {
            newAlerts.push({
              id: hash,
              ticker: ticker,
              type: "STOP_LOSS_HIT",
              urgency: "HIGH",
              title: `🛑 Stop-Loss Tercapai: ${cleanTicker}`,
              body: `Harga ${cleanTicker} (Rp ${price.toLocaleString("id-ID")}) telah menyentuh batas stop-loss Rp ${sl.toLocaleString("id-ID")}. Pertimbangkan untuk review posisi.`,
              timestamp: new Date().toISOString(),
              isRead: false,
              data: { ticker, currentPrice: price, stopLoss: sl }
            });
            sentHashes[hash] = now;
          }
        }

        if (tp && price >= tp) {
          const hash = `TP_HIT_${ticker}_${Math.round(tp)}`;
          if (!sentHashes[hash] || (now - sentHashes[hash]) > COOLDOWN_MS) {
            newAlerts.push({
              id: hash,
              ticker: ticker,
              type: "TAKE_PROFIT_HIT",
              urgency: "HIGH",
              title: `🎯 Take-Profit Tercapai: ${cleanTicker}`,
              body: `Harga ${cleanTicker} (Rp ${price.toLocaleString("id-ID")}) telah mencapai target take-profit Rp ${tp.toLocaleString("id-ID")}. Pertimbangkan untuk ambil keuntungan.`,
              timestamp: new Date().toISOString(),
              isRead: false,
              data: { ticker, currentPrice: price, takeProfit: tp }
            });
            sentHashes[hash] = now;
          }
        }
      }
```

---

### Task 3.5 — Android App Branding (Icon + Splash)

**Steps:**

1. **Install Capacitor assets and splash screen plugins:**
   ```bash
   cd frontend
   npm install @capacitor/splash-screen
   npm install --save-dev @capacitor/assets
   ```

2. **Create icon source files:**
   - Create `frontend/assets/` directory
   - Place a 1024x1024 `icon.png` (app icon) and a 2732x2732 `splash.png` (splash screen)
   - You can generate a simple icon with the app name "ChartsOff" and a stock chart motif
   - Run: `npx @capacitor/assets generate --android`

3. **Update** `frontend/capacitor.config.json`:
   ```json
   {
     "appId": "com.chartsoff.app",
     "appName": "ChartsOff",
     "webDir": "dist",
     "server": {
       "androidScheme": "https",
       "cleartext": true
     },
     "plugins": {
       "SplashScreen": {
         "launchShowDuration": 2000,
         "backgroundColor": "#F8F7F4",
         "showSpinner": false,
         "androidSplashResourceName": "splash"
       }
     }
   }
   ```

4. **Sync:**
   ```bash
   npx cap sync android
   ```

---

## Phase 4: Testing & Verification

After completing all changes, verify:

```bash
# 1. Run existing tests (should all pass)
cd C:\Project\ChartsOff
python -m pytest tests/ -v

# 2. Run the pipeline locally to verify ML fixes
python -m src.pipeline --tickers BBCA.JK BBRI.JK --train

# 3. Start the API server to verify api.py fixes
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload

# 4. Build the frontend
cd frontend
npm ci
npm run build

# 5. Sync & build Android
npx cap sync android
```

**Expected behavior after fixes:**
- Tests pass (win rates may change slightly — the old rates had look-ahead bias from `bfill`)
- Pipeline runs without errors
- API creates fresh model per request (no cross-ticker contamination)
- Frontend polls every 30min instead of 60s

---

## Task Checklist

### Phase 1: Critical Fixes
- [x] **1.1** Fix `bfill` → `ffill` in `technical.py` + add NaN handling in `custom_trainer.py`
- [x] **1.2** Remove global `ml_model` from `api.py`, create fresh instance per request, add macro data
- [x] **1.3** Update `requirements.txt` (add fastapi/uvicorn, remove ta/nltk)
- [x] **1.4** Fix `prepare_features()` signature in `base.py`

### Phase 2: Moderate Improvements
- [x] **2.1** Reduce polling from 60s to 30min in `App.jsx`
- [x] **2.2** Add model persistence (`ml_model.save()`) in `pipeline.py` + update `.gitignore`
- [x] **2.3** Extract `App.jsx` into `usePredictions`, `usePortfolio`, `useFavorites`, `useNotifications` hooks

### Phase 3: New Features
- [x] **3.1** Build Portfolio P&L Dashboard tab component
- [x] **3.2** Add ML feature importance to `key_factors` in `custom_trainer.py`
- [x] **3.3** Build Sector Heatmap component
- [x] **3.4** Add Stop-Loss / Take-Profit price target notifications in `notificationService.js`
- [x] **3.5** Android branding (icon + splash screen)

---

> [!IMPORTANT]
> **Priority order:** Always do Phase 1 first — these are correctness bugs that affect prediction quality. Phase 2 are quality-of-life improvements. Phase 3 are additive features that can be done in any order.
>
> The most impactful single change for ML accuracy is **Task 1.1** (fixing `bfill` data leakage). The most impactful user-facing change is **Task 3.1** (Portfolio P&L Dashboard).
