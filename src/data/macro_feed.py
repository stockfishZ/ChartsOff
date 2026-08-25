import logging
from datetime import datetime, timedelta
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

MACRO_TICKERS = {
    "ihsg": "^JKSE",
    "usdidr": "USDIDR=X",
    "gold": "GC=F",
    "oil": "CL=F",
}

class MacroDataFeed:
    """
    Mengambil dan menyelaraskan data makro ekonomi & harga komoditas global
    (IHSG, Kurs USD/IDR, Harga Emas, Minyak Dunia) untuk konteks pasar BEI.
    """
    def __init__(self, historical_days: int = 120):
        self.historical_days = historical_days
        self._cached_data = None
        self._last_fetched = None

    def fetch_macro_benchmarks(self, force_refresh: bool = False) -> pd.DataFrame:
        """
        Mengunduh data penutupan harian 4 instrumen makro utama.
        """
        now = datetime.now()
        if not force_refresh and self._cached_data is not None and self._last_fetched:
            if (now - self._last_fetched).total_seconds() < 3600:
                return self._cached_data

        start_date = (now - timedelta(days=self.historical_days)).strftime("%Y-%m-%d")
        ticker_list = list(MACRO_TICKERS.values())

        try:
            logger.info(f"Fetching macro benchmarks: {ticker_list} from {start_date}")
            raw = yf.download(
                tickers=ticker_list,
                start=start_date,
                interval="1d",
                progress=False,
                auto_adjust=True
            )

            if raw.empty:
                logger.warning("Macro data feed returned empty dataframe.")
                return pd.DataFrame()

            # Extract Close prices
            if "Close" in raw.columns:
                close_df = raw["Close"].copy()
            else:
                close_df = raw.copy()

            # Flatten MultiIndex if necessary
            if isinstance(close_df.columns, pd.MultiIndex):
                close_df.columns = [col[0] for col in close_df.columns]

            # Rename columns to standard keys
            col_map = {v: k for k, v in MACRO_TICKERS.items()}
            close_df.rename(columns=col_map, inplace=True)

            # Ensure all standard columns exist
            for key in MACRO_TICKERS.keys():
                if key not in close_df.columns:
                    close_df[key] = float("nan")

            close_df.reset_index(inplace=True)
            close_df.rename(columns={"Date": "timestamp", "Datetime": "timestamp"}, inplace=True)
            
            # Forward fill missing weekend/holiday data across timezones
            close_df.ffill(inplace=True)
            close_df.bfill(inplace=True)

            self._cached_data = close_df
            self._last_fetched = now
            return close_df

        except Exception as e:
            logger.error(f"Error fetching macro benchmarks: {e}")
            return pd.DataFrame()

    def get_latest_macro_summary(self) -> dict:
        """
        Mengembalikan ringkasan kondisi makro terkini untuk dashboard dan prompt.
        """
        df = self.fetch_macro_benchmarks()
        if df.empty or len(df) < 5:
            return {
                "ihsg_status": "Netral",
                "ihsg_roc_5": 0.0,
                "usdidr_roc_5": 0.0,
                "macro_regime": "Netral"
            }

        last_row = df.iloc[-1]
        prev_5_row = df.iloc[-5] if len(df) >= 5 else df.iloc[0]

        ihsg_roc = ((last_row["ihsg"] - prev_5_row["ihsg"]) / (prev_5_row["ihsg"] + 1e-9)) * 100
        usdidr_roc = ((last_row["usdidr"] - prev_5_row["usdidr"]) / (prev_5_row["usdidr"] + 1e-9)) * 100

        ihsg_status = "Menguat (Bullish)" if ihsg_roc > 0.5 else "Terkoreksi (Bearish)" if ihsg_roc < -0.5 else "Konsolidasi"
        
        return {
            "ihsg_current": round(float(last_row.get("ihsg", 0)), 2),
            "ihsg_roc_5": round(float(ihsg_roc), 2),
            "ihsg_status": ihsg_status,
            "usdidr_current": round(float(last_row.get("usdidr", 0)), 2),
            "usdidr_roc_5": round(float(usdidr_roc), 2),
            "gold_current": round(float(last_row.get("gold", 0)), 2),
            "oil_current": round(float(last_row.get("oil", 0)), 2),
        }
