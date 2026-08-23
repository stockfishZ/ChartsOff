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
    assert summary["sentiment_label"] == "Bullish"

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
    assert "train_accuracy" in train_res
    assert model.is_trained is True
    
    # Predict
    pred = model.predict(features_df, current_price=150.0, news_summary=news_summary)
    assert pred.ticker == "AAPL"
    assert pred.signal in ["Bullish", "Bearish", "Neutral"]
    assert 0 <= pred.confidence <= 100
    assert len(pred.key_factors) > 0
