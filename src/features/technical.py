import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

class TechnicalFeatureEngine:
    """
    Computes mathematical and technical indicator features from raw OHLCV price series.
    """

    @staticmethod
    def compute_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute standard suite of quantitative features on an OHLCV dataframe.
        Expects columns: ['timestamp', 'Open', 'High', 'Low', 'Close', 'Volume']
        """
        if df.empty or len(df) < 30:
            logger.warning("Dataframe has insufficient rows for technical calculation (min 30 bars required).")
            return df

        res = df.copy()
        close = res["Close"]
        high = res["High"]
        low = res["Low"]
        volume = res["Volume"]

        # 1. Moving Averages
        res["ema_9"] = close.ewm(span=9, adjust=False).mean()
        res["ema_21"] = close.ewm(span=21, adjust=False).mean()
        res["sma_50"] = close.rolling(window=50, min_periods=10).mean()
        res["sma_200"] = close.rolling(window=200, min_periods=20).mean()
        res["ma_trend_bullish"] = (res["ema_9"] > res["ema_21"]).astype(int)

        # 2. RSI (14-period)
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss + 1e-9)
        res["rsi_14"] = 100 - (100 / (1 + rs))

        # 3. MACD (12, 26, 9)
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        res["macd"] = ema_12 - ema_26
        res["macd_signal"] = res["macd"].ewm(span=9, adjust=False).mean()
        res["macd_hist"] = res["macd"] - res["macd_signal"]

        # 4. Bollinger Bands (20, 2)
        bb_mid = close.rolling(window=20).mean()
        bb_std = close.rolling(window=20).std()
        res["bb_upper"] = bb_mid + (2 * bb_std)
        res["bb_lower"] = bb_mid - (2 * bb_std)
        res["bb_width"] = (res["bb_upper"] - res["bb_lower"]) / (bb_mid + 1e-9)
        res["bb_pct_b"] = (close - res["bb_lower"]) / (res["bb_upper"] - res["bb_lower"] + 1e-9)

        # 5. Average True Range (ATR 14) - Volatility
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        res["atr_14"] = true_range.rolling(window=14).mean()
        res["volatility_pct"] = (res["atr_14"] / close) * 100

        # 6. Momentum & Rate of Change (ROC)
        res["roc_5"] = close.pct_change(periods=5) * 100
        res["roc_20"] = close.pct_change(periods=20) * 100

        # 7. Volume Dynamics
        vol_sma_20 = volume.rolling(window=20).mean()
        res["volume_ratio"] = volume / (vol_sma_20 + 1e-9)

        # Clean NaN rows resulting from rolling windows
        res.bfill(inplace=True)
        res.ffill(inplace=True)
        
        return res
