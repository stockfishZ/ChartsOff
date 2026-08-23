# ChartsOff — ML Stock Prediction Vessel & Pipeline 📈🤖

An automated, serverless quantitative & news-driven machine learning prediction engine designed to feed high-confidence stock signals to your Android app at **$0/mo infrastructure cost**.

---

## 🏗️ Architecture & Component Overview

```
ChartsOff/
├── .github/workflows/
│   └── daily_pipeline.yml     # Free scheduled GitHub Actions cron (runs daily after market close)
├── src/
│   ├── config.py              # Settings, tickers list, prediction horizon
│   ├── data/
│   │   ├── market_feed.py     # Quantitative OHLCV fetcher (free yfinance integration)
│   │   └── news_feed.py       # News & catalysts parser (free Google/Yahoo RSS feeds)
│   ├── features/
│   │   ├── technical.py       # Math engine: RSI, MACD, Bollinger Bands, ATR, Volatility, ROC
│   │   └── sentiment.py       # Financial NLP engine: sentiment polarity & news volume scoring
│   ├── ml/
│   │   ├── base.py            # 🌟 THE ML VESSEL: Abstract BaseStockModel & PredictionResult schema
│   │   └── custom_trainer.py  # 🎯 WHERE YOU PLUG IN YOUR CUSTOM TRAINING METHOD
│   ├── storage/
│   │   └── supabase_client.py # Exporter to Supabase (free PostgreSQL) & local JSON fallback
│   └── pipeline.py            # Orchestrator (Data -> Calculations -> Model -> JSON/DB)
├── tests/
│   └── test_pipeline.py       # Pipeline & calculation verification tests
└── requirements.txt
```

---

## 🎯 How to Plug In Your Custom ML Training Method

Open [`src/ml/custom_trainer.py`](src/ml/custom_trainer.py):

1. **`prepare_features()`**: Customize your mathematical indicators or news embeddings.
2. **`train()`**: Insert your custom training loops (e.g. XGBoost, PyTorch, LightGBM, Custom Loss, Reinforcement Learning).
3. **`predict()`**: Compute the final confidence score, directional signal, and explainability factors.

---

## 🚀 Quick Start (Local Run)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Prediction Pipeline
```bash
# Run prediction on default watchlist
python -m src.pipeline

# Run prediction with on-the-fly model training on specific stocks
python -m src.pipeline --tickers AAPL NVDA TSLA --train
```

### 3. Run Verification Tests
```bash
pytest tests/
```

The output predictions are saved automatically to `outputs/latest_predictions.json` and pushed to your free **Supabase** table when configured.
