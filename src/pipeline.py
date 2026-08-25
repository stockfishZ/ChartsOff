import argparse
import logging
from src.config import config
from src.data.market_feed import MarketDataFeed
from src.data.news_feed import NewsDataFeed
from src.features.sentiment import SentimentFeatureEngine
from src.ml.custom_trainer import CustomStockMLModel
from src.storage.supabase_client import StorageManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ChartsOff.Pipeline")

def run_pipeline(tickers: list[str] | None = None, train_model: bool = True):
    """
    Main orchestration loop for data ingestion, feature calculation, ML prediction, and export.
    """
    tickers = tickers or config.DEFAULT_TICKERS
    logger.info(f"Running prediction pipeline for tickers: {tickers}")

    market_feed = MarketDataFeed(historical_days=config.HISTORICAL_DAYS)
    news_feed = NewsDataFeed(lookback_days=config.NEWS_LOOKBACK_DAYS)
    storage = StorageManager()

    all_predictions = []

    for ticker in tickers:
        logger.info(f"\n--- Processing {ticker} ---")
        ml_model = CustomStockMLModel()
        
        # 1. Market Data Fetch
        ohlcv_df = market_feed.fetch_historical_ohlcv(ticker=ticker, interval="1d")
        if ohlcv_df.empty:
            logger.warning(f"Skipping {ticker} due to empty price data.")
            continue
            
        quote = market_feed.fetch_current_quote(ticker=ticker)
        current_price = quote.get("current_price") or float(ohlcv_df["Close"].iloc[-1])

        # 2. News Data & Sentiment Extraction
        news_df = news_feed.fetch_news_for_ticker(ticker=ticker)
        news_summary = SentimentFeatureEngine.aggregate_news_sentiment(news_df, ticker=ticker)

        # 3. Feature Engineering
        features_df = ml_model.prepare_features(ohlcv_df=ohlcv_df, news_summary=news_summary)

        # 4. Optional Model Training
        if train_model:
            ml_model.train(X=features_df)

        # 5. Prediction Inference
        prediction = ml_model.predict(
            X_latest=features_df,
            current_price=current_price,
            news_summary=news_summary
        )
        all_predictions.append(prediction)
        logger.info(f"[{ticker}] Signal: {prediction.signal} | Confidence: {prediction.confidence}% | Regime: {prediction.market_regime}")

    # 6. Save Predictions to Cloud / Local
    storage_res = storage.save_predictions(all_predictions)
    logger.info(f"Pipeline complete! Storage result: {storage_res}")

    # Print summary to terminal
    print("\n======================= CHARTSOFF PREDICTIONS =======================")
    for p in all_predictions:
        print(f"• {p.ticker:5s} | ${p.current_price:<8.2f} | Signal: {p.signal:<8s} ({p.confidence:>5.1f}%) | Regime: {p.market_regime:<15s} | Exp. 5D Move: {p.expected_return_pct:>+5.2f}%")
    print("=====================================================================\n")

    return all_predictions

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ChartsOff ML Pipeline Runner")
    parser.add_argument("--tickers", nargs="+", help="Specific tickers to run (e.g. AAPL NVDA)")
    parser.add_argument("--train", action="store_true", help="Train model weights before predicting")
    args = parser.parse_args()

    run_pipeline(tickers=args.tickers, train_model=args.train)
