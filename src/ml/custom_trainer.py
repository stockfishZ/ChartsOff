import logging
from pathlib import Path
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

from src.features.technical import TechnicalFeatureEngine
from src.features.sentiment import SentimentFeatureEngine
from src.ml.base import BaseStockModel, PredictionResult

logger = logging.getLogger("ChartsOff.BrokerML")

class AdaptiveBrokerWalkForwardModel(BaseStockModel):
    """
    ML Model dengan Walk-Forward Blind Simulation 20 Hari & Adaptive News Attribution.
    """

    def __init__(self, model_name: str = "BrokerAdaptive20D"):
        super().__init__(model_name=model_name)
        self.scaler = StandardScaler()
        self.classifier = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.05,
            max_depth=3,
            random_state=42
        )
        self.regressor = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.05,
            max_depth=3,
            random_state=42
        )
        
        self.feature_columns = [
            "ma_trend_bullish", "ema_9", "ema_21", "sma_50",
            "rsi_14", "macd", "macd_hist",
            "bb_pct_b", "bb_width", "volatility_pct",
            "volume_ratio", "roc_5", "roc_20",
            "news_avg_sentiment", "news_count"
        ]
        
        # Adaptive Feature Weights
        self.feature_weights = {
            "trend": 1.0,
            "momentum": 1.0,
            "volume": 1.0,
            "news": 1.0
        }
        
        self.backtest_metrics = {
            "total_simulations": 0,
            "correct_predictions": 0,
            "win_rate_pct": 0.0,
            "false_calc_count": 0,
            "news_disruption_count": 0
        }

    def prepare_features(self, ohlcv_df: pd.DataFrame, news_summary: dict | None = None) -> pd.DataFrame:
        df = TechnicalFeatureEngine.compute_all_indicators(ohlcv_df)
        news_sentiment = news_summary.get("avg_sentiment", 0.0) if news_summary else 0.0
        news_count = news_summary.get("news_count", 0) if news_summary else 0
        
        df["news_avg_sentiment"] = news_sentiment
        df["news_count"] = news_count
        return df

    def walk_forward_blind_simulation(
        self,
        df: pd.DataFrame,
        horizon_days: int = 20,
        step_size: int = 5,
        min_train_bars: int = 60
    ) -> dict:
        """
        Simulasi blindfold walk-forward step-by-step:
        Menutupi mata model untuk memprediksi 20 hari ke depan, lalu mengevaluasi
        apakah kegagalan disebabkan oleh False Technical Calc atau News Disruption.
        """
        total_rows = len(df)
        if total_rows < (min_train_bars + horizon_days):
            logger.warning(f"Data tidak cukup untuk walk-forward simulation.")
            return self.backtest_metrics

        points = 0
        total_tests = 0
        false_calcs = 0
        news_disruptions = 0

        for t in range(min_train_bars, total_rows - horizon_days, step_size):
            train_slice = df.iloc[:t].copy()
            future_actual_slice = df.iloc[t : t + horizon_days].copy()
            
            current_close = train_slice["Close"].iloc[-1]
            future_close = future_actual_slice["Close"].iloc[-1]
            actual_return = (future_close - current_close) / current_close
            actual_direction = 1 if actual_return > 0.005 else (-1 if actual_return < -0.005 else 0)

            latest_features = train_slice[self.feature_columns].iloc[[-1]].copy()
            
            # Rule Broker Baseline
            rsi = latest_features["rsi_14"].iloc[0]
            macd_hist = latest_features["macd_hist"].iloc[0]
            trend_bull = latest_features["ma_trend_bullish"].iloc[0]
            vol_ratio = latest_features["volume_ratio"].iloc[0]
            news_score = latest_features["news_avg_sentiment"].iloc[0]
            volatility = latest_features["volatility_pct"].iloc[0]

            broker_score = 0.0
            if trend_bull: broker_score += 0.35 * self.feature_weights["trend"]
            else: broker_score -= 0.35 * self.feature_weights["trend"]
            
            if rsi < 40: broker_score += 0.3 * self.feature_weights["momentum"]
            elif rsi > 60: broker_score -= 0.3 * self.feature_weights["momentum"]
            
            if macd_hist > 0: broker_score += 0.25 * self.feature_weights["momentum"]
            else: broker_score -= 0.25 * self.feature_weights["momentum"]

            if vol_ratio > 1.2: broker_score += (0.2 if broker_score > 0 else -0.2) * self.feature_weights["volume"]
            broker_score += (news_score * 0.4) * self.feature_weights["news"]

            pred_direction = 1 if broker_score > 0.10 else (-1 if broker_score < -0.10 else 0)

            total_tests += 1
            if (pred_direction == actual_direction) or (pred_direction > 0 and actual_return > 0) or (pred_direction < 0 and actual_return < 0):
                points += 1
            else:
                # Cek apakah terjadi exogenous shock (lonjakan volume tajam atau volatilitas ekstrem)
                future_vol = (future_actual_slice["High"].max() - future_actual_slice["Low"].min()) / current_close * 100
                is_shock = (future_vol > (volatility * 2.5)) or (abs(news_score) > 0.2)
                
                if is_shock:
                    news_disruptions += 1
                    self.feature_weights["news"] = min(2.5, self.feature_weights["news"] * 1.02)
                else:
                    false_calcs += 1
                    self.feature_weights["momentum"] = max(0.6, self.feature_weights["momentum"] * 0.98)

        win_rate = (points / total_tests * 100) if total_tests > 0 else 0.0
        self.backtest_metrics = {
            "total_simulations": total_tests,
            "correct_predictions": points,
            "win_rate_pct": round(win_rate, 1),
            "false_calc_count": false_calcs,
            "news_disruption_count": news_disruptions
        }
        logger.info(f"Walk-Forward Simulation: {points}/{total_tests} Poin ({win_rate:.1f}% Win Rate). False Calc: {false_calcs}, News Shock: {news_disruptions}")
        return self.backtest_metrics

    def train(self, X: pd.DataFrame, y: pd.Series | None = None) -> dict:
        self.walk_forward_blind_simulation(X, horizon_days=20, step_size=5)

        features = X[self.feature_columns].dropna()
        if len(features) < 40:
            logger.warning("Data tidak mencukupi untuk pelatihan model.")
            return {"status": "insufficient_data"}

        # Target 20-Day Classification & Return Regression
        future_return_20d = (X["Close"].shift(-20) - X["Close"]) / X["Close"]
        y_class = (future_return_20d > 0.005).astype(int).loc[features.index]
        y_reg = future_return_20d.loc[features.index]

        valid_idx = features.index.intersection(y_class.dropna().index).intersection(y_reg.dropna().index)
        X_train = features.loc[valid_idx]
        y_train_class = y_class.loc[valid_idx]
        y_train_reg = y_reg.loc[valid_idx]

        if len(X_train) < 30:
            return {"status": "insufficient_data"}

        X_scaled = self.scaler.fit_transform(X_train)
        self.classifier.fit(X_scaled, y_train_class)
        self.regressor.fit(X_scaled, y_train_reg)
        self.is_trained = True

        acc = float(self.classifier.score(X_scaled, y_train_class))
        return {
            "train_accuracy": round(acc, 4),
            "samples": len(X_train),
            "walk_forward_win_rate": self.backtest_metrics["win_rate_pct"],
            "feature_weights": self.feature_weights
        }

    def predict(
        self,
        X_latest: pd.DataFrame,
        current_price: float,
        news_summary: dict | None = None
    ) -> PredictionResult:
        ticker = X_latest["ticker"].iloc[-1] if "ticker" in X_latest else "UNKNOWN"
        latest_row = X_latest[self.feature_columns].iloc[[-1]]
        
        volatility = float(latest_row["volatility_pct"].iloc[0])
        rsi = float(latest_row["rsi_14"].iloc[0])
        macd_hist = float(latest_row["macd_hist"].iloc[0])
        news_score = float(latest_row["news_avg_sentiment"].iloc[0])
        trend_bull = bool(latest_row["ma_trend_bullish"].iloc[0])

        if volatility > 3.5:
            regime = "Volatilitas Tinggi"
        elif trend_bull and rsi > 50:
            regime = "Tren Menguat (Bullish)"
        elif not trend_bull and rsi < 50:
            regime = "Tren Melemah (Bearish)"
        else:
            regime = "Konsolidasi (Sideways)"

        if self.is_trained:
            X_scaled = self.scaler.transform(latest_row)
            probs = self.classifier.predict_proba(X_scaled)[0]
            bullish_prob = float(probs[1]) if len(probs) > 1 else 0.5
            pred_return = float(self.regressor.predict(X_scaled)[0]) * 100
        else:
            bullish_prob = 0.5 + (0.25 * news_score) + (0.15 if trend_bull else -0.15)
            bullish_prob = max(0.05, min(0.95, bullish_prob))
            pred_return = (bullish_prob - 0.5) * 8.0

        if bullish_prob >= 0.55:
            signal = "Beli (Bullish)"
            confidence = round(bullish_prob * 100, 1)
            expected_return = max(0.5, round(pred_return, 2))
        elif bullish_prob <= 0.45:
            signal = "Waspada (Bearish)"
            confidence = round((1.0 - bullish_prob) * 100, 1)
            expected_return = min(-0.5, round(pred_return, 2))
        else:
            signal = "Tunggu (Netral)"
            confidence = round((1.0 - abs(bullish_prob - 0.5) * 2) * 100, 1)
            expected_return = 0.0

        rsi_status = "Jenuh Jual (Oversold)" if rsi < 35 else ("Jenuh Beli (Overbought)" if rsi > 65 else "Netral")
        macd_status = "Golden Cross (Positif)" if macd_hist > 0 else "Dead Cross (Tekanan Jual)"
        win_rate = self.backtest_metrics.get("win_rate_pct", 75.0)

        key_factors = [
            {"factor": "RSI 14 Hari", "value": round(rsi, 2), "status": rsi_status},
            {"factor": "Momentum MACD", "value": round(macd_hist, 4), "status": macd_status},
            {"factor": "Sentimen Berita", "value": round(news_score, 2), "status": news_summary.get("sentiment_label", "Netral") if news_summary else "Netral"},
            {"factor": "Win Rate Simulasi", "value": f"{win_rate}%", "status": f"{self.backtest_metrics.get('correct_predictions', 0)}/{self.backtest_metrics.get('total_simulations', 0)} Poin"}
        ]

        history = []
        if "Close" in X_latest.columns:
            recent_bars = X_latest.tail(90)
            for _, row in recent_bars.iterrows():
                ts = row.get("timestamp")
                date_str = str(ts)[:10] if ts is not None else ""
                history.append({
                    "date": date_str,
                    "close": round(float(row["Close"]), 2),
                    "open": round(float(row["Open"]), 2) if "Open" in row else round(float(row["Close"]), 2),
                    "high": round(float(row["High"]), 2) if "High" in row else round(float(row["Close"]), 2),
                    "low": round(float(row["Low"]), 2) if "Low" in row else round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else 0
                })

        return PredictionResult(
            ticker=ticker,
            current_price=round(float(current_price), 2),
            signal=signal,
            confidence=confidence,
            expected_return_pct=expected_return,
            target_horizon_days=20,
            market_regime=regime,
            key_factors=key_factors,
            news_sentiment=news_summary or {},
            historical_prices=history,
            model_version=f"{self.model_name} (WinRate: {win_rate}%)"
        )

    def save(self, filepath: str) -> None:
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "classifier": self.classifier,
            "regressor": self.regressor,
            "scaler": self.scaler,
            "weights": self.feature_weights,
            "metrics": self.backtest_metrics,
            "is_trained": self.is_trained
        }, filepath)

    def load(self, filepath: str) -> None:
        data = joblib.load(filepath)
        self.classifier = data["classifier"]
        self.regressor = data["regressor"]
        self.scaler = data["scaler"]
        self.feature_weights = data.get("weights", self.feature_weights)
        self.backtest_metrics = data.get("metrics", self.backtest_metrics)
        self.is_trained = data.get("is_trained", True)

# Alias for backwards compatibility
CustomStockMLModel = AdaptiveBrokerWalkForwardModel
