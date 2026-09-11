import pytest
import pandas as pd
import numpy as np
from src.data.market_feed import MarketDataFeed
from src.data.news_feed import NewsDataFeed
from src.features.technical import TechnicalFeatureEngine
from src.features.sentiment import SentimentFeatureEngine
from src.ml.custom_trainer import CustomStockMLModel
from src.storage.supabase_client import StorageManager

def test_technical_feature_calculations():
    # Generate synthetic OHLCV data
    dates = pd.date_range("2024-01-01", periods=60)
    prices = np.linspace(100, 150, 60) + np.random.normal(0, 2, 60)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices - 1,
        "High": prices + 2,
        "Low": prices - 2,
        "Close": prices,
        "Volume": np.random.randint(1000000, 5000000, 60),
        "ticker": "AAPL"
    })

    result_df = TechnicalFeatureEngine.compute_all_indicators(df)
    
    assert "rsi_14" in result_df.columns
    assert "macd" in result_df.columns
    assert "bb_pct_b" in result_df.columns
    assert "volatility_pct" in result_df.columns
    assert len(result_df) == 60

def test_sentiment_scoring():
    news_data = pd.DataFrame([
        {"title": "Apple surges on record profit and dividend increase", "summary": "Growth beats estimates", "link": "http://example.com", "published_at": "today"},
        {"title": "Tech stocks rally as inflation concerns ease", "summary": "Bullish outlook", "link": "http://example.com", "published_at": "today"}
    ])
    
    summary = SentimentFeatureEngine.aggregate_news_sentiment(news_data, "AAPL")
    assert summary["news_count"] == 2
    assert summary["avg_sentiment"] > 0.1
    assert "Bullish" in summary["sentiment_label"]

def test_ml_vessel_train_and_predict():
    dates = pd.date_range("2024-01-01", periods=80)
    prices = np.linspace(100, 150, 80)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 2000000,
        "ticker": "AAPL"
    })
    
    news_summary = {"avg_sentiment": 0.3, "news_count": 5, "sentiment_label": "Bullish"}
    
    model = CustomStockMLModel()
    features_df = model.prepare_features(df, news_summary)
    
    # Train
    train_res = model.train(features_df)
    assert "win_rate_pct" in train_res or "samples" in train_res or train_res.get("status") == "trained"
    assert model.is_trained is True
    
    # Predict
    pred = model.predict(features_df, current_price=150.0, news_summary=news_summary)
    assert pred.ticker == "AAPL"
    assert any(s in pred.signal for s in ["Bullish", "Bearish", "Neutral", "Beli", "Jual", "Tahan", "Netral", "Tunggu", "Waspada"])
    assert 0 <= pred.confidence <= 100
    assert len(pred.key_factors) > 0
    assert "stop_loss_price" in pred.risk_management
    assert "take_profit_price" in pred.risk_management
    assert "health_score" in pred.fundamentals
    assert "cmf_20" in pred.institutional_flow

def test_dynamic_sentiment_recalibration():
    # Verify that sudden negative breaking news dynamically flips/recalibrates the ML prediction
    dates = pd.date_range("2024-01-01", periods=80)
    prices = np.linspace(100, 150, 80)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 2000000,
        "ticker": "BBCA.JK"
    })

    model = CustomStockMLModel()
    
    # 1. Prediction with positive sentiment
    pos_news = {"avg_sentiment": 0.45, "news_count": 5, "sentiment_label": "Positif (Bullish)"}
    features_pos = model.prepare_features(df, pos_news)
    model.train(features_pos)
    pred_pos = model.predict(features_pos, current_price=10000.0, news_summary=pos_news)
    
    # 2. Sudden breaking bad news arrives today (e.g. profit crash / lawsuit)
    bad_news = {"avg_sentiment": -0.65, "news_count": 8, "sentiment_label": "Negatif (Bearish)"}
    features_bad = model.prepare_features(df, bad_news)
    pred_bad = model.predict(features_bad, current_price=10000.0, news_summary=bad_news)

    # Assert that negative news dynamically dropped the expected return and shifted signal
    assert pred_bad.expected_return_pct < pred_pos.expected_return_pct
    assert pred_bad.signal != "Beli (Bullish)" or pred_bad.confidence < pred_pos.confidence

def test_precision_action_engine_urgent_sell_and_prime_buy():
    from src.ml.precision_action_engine import PrecisionActionEngine
    engine = PrecisionActionEngine()

    # 1. Test Urgent Sell Emergency Condition
    bad_features = {
        "rsi_14": 28.0,
        "macd_hist": -0.15,
        "ma_trend_bullish": 0,
        "volume_ratio": 1.6,
        "bb_pct_b": 0.05,
        "volatility_pct": 4.5,
        "roc_5": -5.2
    }
    bad_news = {
        "avg_sentiment": -0.6,
        "news_count": 4,
        "top_headlines": [{"title": "Emiten menghadapi gugatan PKPU dan pembengkakan utang"}]
    }
    holding = {"buyPrice": 5000, "shares": 100}
    sell_alert = engine.evaluate_action_alert("BBCA.JK", current_price=4600, features_row=bad_features, news_summary=bad_news, holding_info=holding)
    
    assert sell_alert["type"] == "URGENT_SELL"
    assert sell_alert["urgency"] == "HIGH"
    assert "Jual Darurat" in sell_alert["title"] or "URGENT" in sell_alert["title"]

    # 2. Test Prime Buy Golden Setup Condition
    prime_features = {
        "rsi_14": 56.0,
        "macd_hist": 0.08,
        "ma_trend_bullish": 1,
        "volume_ratio": 1.45,
        "bb_pct_b": 0.65,
        "volatility_pct": 2.1,
        "roc_5": 2.8
    }
    good_news = {
        "avg_sentiment": 0.55,
        "news_count": 6,
        "top_headlines": [{"title": "Laba bersih melonjak 35% dan pembagian dividen interim"}]
    }
    good_fund = {"health_score": 85, "der_ratio": 0.4, "roe_pct": 20.0, "grade": "A+ (Sangat Sehat)"}
    good_flow = {"flow_score": 75, "cmf_20": 0.12, "is_accumulating": True}
    buy_alert = engine.evaluate_action_alert("TLKM.JK", current_price=3500, features_row=prime_features, news_summary=good_news, fundamentals=good_fund, flow_summary=good_flow)
    
    assert buy_alert["type"] == "PRIME_BUY"
    assert buy_alert["urgency"] == "HIGH"
    assert "Prospek Bagus" in buy_alert["title"] or "PRIME" in buy_alert["title"]

def test_contextual_negation_nlp_and_institutional_features():
    # Test that "tidak bertumbuh" is recognized as negative, not positive
    pos_text = "laba bersih bertumbuh signifikan dan dividen melonjak"
    negated_text = "laba bersih tidak bertumbuh dan pendapatan merosot"
    
    pos_score = SentimentFeatureEngine._score_text_contextual(pos_text)
    neg_score = SentimentFeatureEngine._score_text_contextual(negated_text)
    
    assert pos_score > 0.2
    assert neg_score < -0.1

def test_no_bfill_data_leakage():
    dates = pd.date_range("2024-01-01", periods=60)
    prices = np.linspace(100, 150, 60)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 1000000,
        "ticker": "BBCA"
    })
    result_df = TechnicalFeatureEngine.compute_all_indicators(df)
    # The first row for sma_50 (window=50, min_periods=10) or rsi_14 should be NaN (no bfill)
    assert pd.isna(result_df["sma_50"].iloc[0])
    assert pd.isna(result_df["rsi_14"].iloc[0])

def test_train_guard_insufficient_clean_data():
    dates = pd.date_range("2024-01-01", periods=40)
    prices = np.linspace(100, 150, 40)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 1000000,
        "ticker": "BBCA"
    })
    model = CustomStockMLModel()
    features_df = model.prepare_features(df)
    # Introducing NaNs so clean rows after dropna are < 30 bars
    features_df.loc[:15, "rsi_14"] = np.nan
    res = model.train(features_df)
    assert res is None

    # Test with dataframe having fewer than 30 total rows
    res_short = model.train(features_df.iloc[:20])
    assert res_short is None

def test_feature_importance_in_key_factors_and_persistence(tmp_path):
    dates = pd.date_range("2024-01-01", periods=80)
    prices = np.linspace(100, 150, 80)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 2000000,
        "ticker": "BBCA"
    })
    model = CustomStockMLModel()
    features_df = model.prepare_features(df)
    model.train(features_df)
    
    pred = model.predict(features_df, current_price=10000.0)
    # Key factors should start with top 3 ML feature importances
    key_factors = pred.key_factors
    assert len(key_factors) >= 3
    importance_factors = [kf for kf in key_factors if "🔑" in kf["factor"]]
    assert len(importance_factors) == 3
    for kf in importance_factors:
        assert "Pengaruh" in kf["value"]
        assert kf["status"] == "Faktor Kunci Model ML"

    # Test persistence
    model_path = tmp_path / "latest_model.joblib"
    model.save(str(model_path))
    assert model_path.exists()
    
    loaded_model = CustomStockMLModel()
    loaded_model.load(str(model_path))
    assert loaded_model.is_trained is True
    pred_loaded = loaded_model.predict(features_df, current_price=10000.0)
    assert pred_loaded.ticker == pred.ticker

def test_prepare_features_with_macro_df():
    dates = pd.date_range("2024-01-01", periods=60)
    prices = np.linspace(100, 150, 60)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 1000000,
        "ticker": "BBCA"
    })
    macro_df = pd.DataFrame({
        "timestamp": dates,
        "ihsg": np.linspace(7000, 7200, 60),
        "usdidr": np.linspace(15000, 15500, 60),
        "gold": np.linspace(2000, 2100, 60),
        "oil": np.linspace(70, 75, 60)
    })
    model = CustomStockMLModel()
    features_df = model.prepare_features(df, macro_df=macro_df)
    assert "ihsg_roc_5" in features_df.columns
    assert "usdidr_roc_5" in features_df.columns
    assert "beta_ihsg_30" in features_df.columns

def test_sentiment_compound_phrase_matching():
    # Verify compound phrases match properly
    pos_score = SentimentFeatureEngine._score_text_contextual("Emiten membukukan laba bersih dan dividen interim meningkat")
    assert pos_score > 0.3

    neg_score = SentimentFeatureEngine._score_text_contextual("Emiten mengalami gagal bayar dan penurunan tajam kinerja")
    assert neg_score < -0.3

    # Negation with compound phrase
    negated_score = SentimentFeatureEngine._score_text_contextual("Emiten tidak rugi bersih pada kuartal ini")
    assert negated_score > 0.0

def test_news_lookahead_leakage_prevented():
    dates = pd.date_range("2024-01-01", periods=60)
    prices = np.linspace(100, 150, 60)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": 1000000,
        "ticker": "BBRI.JK"
    })
    news_summary = {"avg_sentiment": 0.45, "news_count": 8, "sentiment_label": "Bullish"}
    model = CustomStockMLModel()
    features_df = model.prepare_features(df, news_summary=news_summary)

    # Older historical bars must be 0.0 to prevent lookahead data leakage
    assert (features_df["news_avg_sentiment"].iloc[:-5] == 0.0).all()
    # Contemporary window (last 5 bars) receives actual news sentiment
    assert (features_df["news_avg_sentiment"].iloc[-5:] == 0.45).all()

def test_adaptive_support_resistance_risk_brackets():
    dates = pd.date_range("2024-01-01", periods=80)
    prices = np.linspace(5000, 5200, 80)
    df = pd.DataFrame({
        "timestamp": dates,
        "Open": prices,
        "High": prices + 50,
        "Low": prices - 50,
        "Close": prices,
        "Volume": 5000000,
        "ticker": "BMRI.JK"
    })
    model = CustomStockMLModel()
    features_df = model.prepare_features(df)
    model.train(features_df)

    pred = model.predict(features_df, current_price=5200.0)
    risk = pred.risk_management
    assert risk["stop_loss_price"] < 5200.0
    assert risk["take_profit_price"] > 5200.0
    # RRR is non-empty and formatted
    assert "1 :" in risk["risk_reward_ratio"]

def test_storage_safe_upsert_and_prune(tmp_path, monkeypatch):
    from src.config import config
    from src.ml.base import PredictionResult
    from src.storage.supabase_client import StorageManager
    import json

    monkeypatch.setattr(config, "LOCAL_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(config, "USE_SUPABASE", False)

    storage = StorageManager()
    
    # 1. Simulate existing predictions with old timestamps (e.g., 2 weeks old)
    old_file = tmp_path / "latest_predictions.json"
    initial_data = [
        {"ticker": "BBCA.JK", "timestamp": "2026-08-25T10:00:00+00:00", "signal": "Beli (Bullish)", "current_price": 9500},
        {"ticker": "BBRI.JK", "timestamp": "2026-08-25T10:00:00+00:00", "signal": "Beli (Bullish)", "current_price": 5000},
        {"ticker": "CUSTOM_ROGUE.JK", "timestamp": "2026-08-25T10:00:00+00:00", "signal": "Netral", "current_price": 100},
    ]
    with open(old_file, "w", encoding="utf-8") as f:
        json.dump(initial_data, f)

    # 2. Run partial update for BMRI.JK with full_run=False
    dummy_pred = PredictionResult(
        ticker="BMRI.JK",
        current_price=4300.0,
        signal="Beli (Bullish)",
        confidence=80.0,
        expected_return_pct=2.5,
        target_horizon_days=20,
        market_regime="Bullish",
        key_factors=[],
        news_sentiment={},
        action_alert={"type": "NONE", "urgency": "LOW", "title": "", "description": "", "action_label": ""},
        risk_management={"stop_loss_price": 4000.0, "take_profit_price": 4600.0, "risk_reward_ratio": "1 : 2.0", "risk_level": "Low", "risk_color": "#000"},
        fundamentals={},
        institutional_flow={},
        macro_context={},
        historical_prices=[]
    )
    storage.save_predictions([dummy_pred], is_incremental=False, sync_to_frontend=False, full_run=False)

    with open(old_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    tickers_present = {x["ticker"] for x in data}
    # Both BBCA and BBRI must still be present even if older than 72h!
    assert "BBCA.JK" in tickers_present
    assert "BBRI.JK" in tickers_present
    assert "BMRI.JK" in tickers_present

    # 3. Now run a full run (full_run=True) - rogue ticker CUSTOM_ROGUE.JK should be pruned, defaults kept
    storage.save_predictions([dummy_pred], is_incremental=False, sync_to_frontend=False, full_run=True)
    with open(old_file, "r", encoding="utf-8") as f:
        data_full = json.load(f)
    tickers_full = {x["ticker"] for x in data_full}
    assert "CUSTOM_ROGUE.JK" not in tickers_full
    assert "BBCA.JK" in tickers_full
    assert "BMRI.JK" in tickers_full

def test_market_data_feed_retry_jitter(monkeypatch):
    import time
    feed = MarketDataFeed(historical_days=30)
    
    sleep_calls = []
    monkeypatch.setattr(time, "sleep", lambda s: sleep_calls.append(s))
    
    calls = 0
    def mock_download(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            return pd.DataFrame()
        dates = pd.date_range("2024-01-01", periods=5)
        return pd.DataFrame({"Date": dates, "Open": [100]*5, "High": [105]*5, "Low": [95]*5, "Close": [102]*5, "Volume": [1000]*5})

    import yfinance as yf
    monkeypatch.setattr(yf, "download", mock_download)
    
    df = feed.fetch_historical_ohlcv("BBCA.JK")
    assert not df.empty
    assert calls == 2
    assert len(sleep_calls) == 1
    assert 0.5 <= sleep_calls[0] <= 1.2

def test_macro_data_feed_holiday_discrepancies_ffill_bfill(monkeypatch):
    from src.data.macro_feed import MacroDataFeed
    feed = MacroDataFeed()
    
    # Simulate holiday gap: day 2 is holiday on BEI (NaN for ihsg), day 3 is US holiday (NaN for gold/oil)
    mock_dates = pd.date_range("2024-01-01", periods=4)
    raw_mock = pd.DataFrame({
        "^JKSE": [7000.0, np.nan, 7100.0, 7150.0],
        "USDIDR=X": [15500.0, 15520.0, 15550.0, 15540.0],
        "GC=F": [2000.0, 2010.0, np.nan, 2030.0],
        "CL=F": [75.0, 76.0, np.nan, 78.0],
    }, index=mock_dates)
    
    import yfinance as yf
    monkeypatch.setattr(yf, "download", lambda *args, **kwargs: raw_mock)
    
    macro_df = feed.fetch_macro_benchmarks(force_refresh=True)
    assert not macro_df.empty
    # Verify no NaN remains after clean ffill().bfill()
    assert not macro_df["ihsg"].isna().any()
    assert not macro_df["gold"].isna().any()
    assert not macro_df["oil"].isna().any()
    # Check that day 2 ihsg was forward filled from day 1
    assert macro_df.loc[macro_df["timestamp"] == mock_dates[1], "ihsg"].values[0] == 7000.0
    # Check that day 3 gold was forward filled from day 2
    assert macro_df.loc[macro_df["timestamp"] == mock_dates[2], "gold"].values[0] == 2010.0

def test_pre_commit_data_quality_gate():
    # Test valid dataset
    valid_predictions = [
        {"ticker": f"TICK{i}.JK", "current_price": 1000 + i, "signal": "Beli (Bullish)", "historical_prices": [100, 101, 102]}
        for i in range(50)
    ]
    req = {'ticker', 'current_price', 'signal', 'historical_prices'}
    assert len(valid_predictions) >= 45
    assert all(req.issubset(x.keys()) for x in valid_predictions)
    
    # Test failure: insufficient tickers (< 45)
    partial_predictions = valid_predictions[:40]
    assert len(partial_predictions) < 45
    
    # Test failure: missing required field
    corrupt_predictions = [dict(x) for x in valid_predictions]
    del corrupt_predictions[0]["signal"]
    assert not all(req.issubset(x.keys()) for x in corrupt_predictions)



