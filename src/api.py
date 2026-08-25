import json
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import config
from src.data.market_feed import MarketDataFeed
from src.data.news_feed import NewsDataFeed
from src.features.sentiment import SentimentFeatureEngine
from src.ml.custom_trainer import CustomStockMLModel
from src.ml.base import PredictionResult
from src.storage.supabase_client import StorageManager, sanitize_json_payload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ChartsOff.API")

app = FastAPI(title="ChartsOff IDX Prediction API")

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

market_feed = MarketDataFeed(historical_days=config.HISTORICAL_DAYS)
news_feed = NewsDataFeed(lookback_days=config.NEWS_LOOKBACK_DAYS)
ml_model = CustomStockMLModel()
storage = StorageManager()

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

@app.get("/api/predictions")
def get_all_predictions():
    """Returns the list of all latest pre-calculated predictions."""
    output_file = config.LOCAL_OUTPUT_DIR / "latest_predictions.json"
    if output_file.exists():
        with open(output_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return sanitize_json_payload(data)
    return []

@app.get("/api/predict/{ticker}")
def predict_stock(ticker: str):
    """Calculates predictions on-the-fly for ANY Indonesian stock."""
    try:
        prediction = compute_prediction_for_ticker(ticker)
        pred_dict = sanitize_json_payload(prediction.model_dump())
        
        # Update local cache
        output_file = config.LOCAL_OUTPUT_DIR / "latest_predictions.json"
        existing = []
        if output_file.exists():
            with open(output_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
                
        # Upsert
        existing = [p for p in existing if p.get("ticker") != prediction.ticker]
        existing.insert(0, pred_dict)
        existing_sanitized = sanitize_json_payload(existing)
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(existing_sanitized, f, indent=2)
            
        # Copy to frontend public
        public_dest = Path("frontend/public/data/latest_predictions.json")
        if public_dest.parent.exists():
            with open(public_dest, "w", encoding="utf-8") as f:
                json.dump(existing_sanitized, f, indent=2)

        return pred_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quote/{ticker}")
def get_live_quote(ticker: str):
    """Fetches real-time market quote and price action for an IDX ticker."""
    try:
        clean_ticker = ticker.upper().strip()
        if not clean_ticker.endswith(".JK"):
            clean_ticker += ".JK"
        quote = market_feed.fetch_current_quote(clean_ticker)
        return sanitize_json_payload(quote)
    except Exception as e:
        logger.warning(f"Error fetching quote for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news/{ticker}")
def get_live_stock_news(ticker: str):
    """Fetches live, fresh news articles specifically for the requested Indonesian stock."""
    try:
        clean_ticker = ticker.upper().strip()
        if not clean_ticker.endswith(".JK"):
            clean_ticker += ".JK"

        news_df = news_feed.fetch_news_for_ticker(clean_ticker, max_articles=8)
        news_summary = SentimentFeatureEngine.aggregate_news_sentiment(news_df, clean_ticker)
        return sanitize_json_payload(news_summary)
    except Exception as e:
        logger.warning(f"Error fetching live news for {ticker}: {e}")
        return {
            "ticker": ticker,
            "news_count": 0,
            "avg_sentiment": 0.0,
            "sentiment_label": "Netral",
            "top_headlines": []
        }
