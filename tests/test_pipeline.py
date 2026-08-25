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
