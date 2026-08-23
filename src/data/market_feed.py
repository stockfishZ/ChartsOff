import logging
from datetime import datetime, timedelta
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

class MarketDataFeed:
    """
    Fetches raw OHLCV market price action and volume data.
    """
    def __init__(self, historical_days: int = 365):
        self.historical_days = historical_days

    def fetch_historical_ohlcv(
        self, ticker: str, interval: str = "1d", days: int | None = None
    ) -> pd.DataFrame:
        """
        Fetch historical Open, High, Low, Close, Volume data for a ticker.
        """
        days = days or self.historical_days
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        try:
            logger.info(f"Fetching {ticker} market data from {start_date} (interval: {interval})")
            data = yf.download(
                tickers=ticker,
                start=start_date,
                interval=interval,
                progress=False,
                auto_adjust=True
            )
            
            if data.empty:
                logger.warning(f"No data returned for ticker {ticker}")
                return pd.DataFrame()
            
            # Flatten multi-index columns if present (from newer yfinance versions)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = [col[0] for col in data.columns]
                
            data.reset_index(inplace=True)
            data.rename(columns={"Date": "timestamp", "Datetime": "timestamp"}, inplace=True)
            data["ticker"] = ticker
            return data
            
        except Exception as e:
            logger.error(f"Error fetching market data for {ticker}: {e}")
            return pd.DataFrame()

    def fetch_current_quote(self, ticker: str) -> dict:
        """
        Fetch the latest quote details (market cap, current price, day high/low).
        """
        try:
            t = yf.Ticker(ticker)
            fast_info = t.fast_info
            return {
                "ticker": ticker,
                "current_price": getattr(fast_info, "last_price", None),
                "previous_close": getattr(fast_info, "previous_close", None),
                "day_high": getattr(fast_info, "day_high", None),
                "day_low": getattr(fast_info, "day_low", None),
                "fifty_two_week_high": getattr(fast_info, "year_high", None),
                "fifty_two_week_low": getattr(fast_info, "year_low", None),
                "market_cap": getattr(fast_info, "market_cap", None),
            }
        except Exception as e:
            logger.error(f"Error fetching current quote for {ticker}: {e}")
            return {"ticker": ticker, "error": str(e)}
