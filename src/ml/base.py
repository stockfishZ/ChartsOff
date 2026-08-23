from abc import ABC, abstractmethod
from datetime import datetime, timezone
import pandas as pd
from pydantic import BaseModel, Field

class PredictionResult(BaseModel):
    """
    Standardized prediction output schema consumed by the Android app and database.
    """
    ticker: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    current_price: float
    signal: str = Field(description="'Bullish', 'Bearish', or 'Neutral'")
    confidence: float = Field(description="Confidence percentage [0.0 - 100.0%]")
    expected_return_pct: float = Field(default=0.0, description="Projected % price move over horizon")
    target_horizon_days: int = 5
    market_regime: str = Field(default="Normal", description="e.g. High_Volatility, Trending_Bull, Mean_Reverting")
    key_factors: list[dict] = Field(default_factory=list, description="Top indicators explaining this prediction")
    news_sentiment: dict = Field(default_factory=dict, description="Summary of news volume & sentiment score")
    historical_prices: list[dict] = Field(default_factory=list, description="Real historical daily OHLCV bars from market feed")
    model_version: str = "custom_v1"

class BaseStockModel(ABC):
    """
    Abstract Vessel for Custom Machine Learning Models.
    Inherit from this class and implement your custom training & inference methods.
    """

    def __init__(self, model_name: str = "BaseStockModel"):
        self.model_name = model_name
        self.is_trained = False

    @abstractmethod
    def prepare_features(self, ohlcv_df: pd.DataFrame, news_summary: dict | None = None) -> pd.DataFrame:
        """
        Transform raw market OHLCV and news metadata into model-ready features (X).
        """
        pass

    @abstractmethod
    def train(self, X: pd.DataFrame, y: pd.Series | None = None) -> dict:
        """
        Execute your custom ML training logic.
        Returns training metrics (e.g. accuracy, loss, F1, Sharpe ratio).
        """
        pass

    @abstractmethod
    def predict(
        self,
        X_latest: pd.DataFrame,
        current_price: float,
        news_summary: dict | None = None
    ) -> PredictionResult:
        """
        Generate a standardized PredictionResult for the latest market bar.
        """
        pass

    @abstractmethod
    def save(self, filepath: str) -> None:
        """
        Serialize model artifacts / weights to disk.
        """
        pass

    @abstractmethod
    def load(self, filepath: str) -> None:
        """
        Load model artifacts / weights from disk.
        """
        pass
