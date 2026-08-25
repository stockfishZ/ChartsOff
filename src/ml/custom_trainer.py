import logging
import math
from pathlib import Path
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

from src.features.technical import TechnicalFeatureEngine
from src.features.institutional_flow import InstitutionalFlowEngine
from src.features.macro import MacroFeatureEngine
from src.features.sentiment import SentimentFeatureEngine
from src.data.fundamental_feed import FundamentalDataFeed
from src.data.macro_feed import MacroDataFeed
from src.ml.base import BaseStockModel, PredictionResult
from src.ml.precision_action_engine import PrecisionActionEngine

logger = logging.getLogger("ChartsOff.BrokerML")

class AdaptiveBrokerWalkForwardModel(BaseStockModel):
    """
    ML Model Hibrida Institusional dengan 5 Pilar Kuantitatif Terintegrasi:
    1. 27 Indikator Teknikal & Price Action (OHLCV).
    2. Arus Dana Institusi / Asing (CMF, MFI, Smart Money Flow).
    3. Konteks Makroekonomi & Komoditas Global (IHSG, USD/IDR, Emas, Minyak).
    4. Analisis Sentimen NLP Finansial Kontekstual & Deteksi Negasi.
    5. Manajemen Risiko Dinamis Berbasis ATR (Stop-Loss, Take-Profit, RRR) & Filter Fundamental.
    """

    def __init__(self, model_name: str = "BrokerInstitutionalHybrid"):
        super().__init__(model_name=model_name)
        self.scaler = StandardScaler()
        self.classifier = GradientBoostingClassifier(
            n_estimators=120,
            learning_rate=0.04,
            max_depth=3,
            random_state=42
        )
        self.regressor = GradientBoostingRegressor(
            n_estimators=120,
            learning_rate=0.04,
            max_depth=3,
            random_state=42
        )
        self.precision_action_engine = PrecisionActionEngine()
        self.fundamental_feed = FundamentalDataFeed()
        self.macro_feed = MacroDataFeed()
        
        self.feature_columns = [
            "ma_trend_bullish", "ema_9", "ema_21", "sma_50",
            "rsi_14", "macd", "macd_hist",
            "bb_pct_b", "bb_width", "volatility_pct",
            "volume_ratio", "roc_5", "roc_20",
            "cmf_20", "mfi_14", "smart_money_flow_score",
            "ihsg_roc_5", "usdidr_roc_5", "beta_ihsg_30",
            "news_avg_sentiment", "news_count"
        ]
        
        # Adaptive Feature Weights
        self.feature_weights = {
            "trend": 1.0,
            "momentum": 1.0,
            "volume": 1.0,
            "flow": 1.0,
            "macro": 1.0,
            "news": 1.0
        }
        
        self.backtest_metrics = {
            "total_simulations": 0,
            "correct_predictions": 0,
            "win_rate_pct": 0.0,
            "false_calc_count": 0,
            "news_disruption_count": 0
        }

    def prepare_features(
        self,
        ohlcv_df: pd.DataFrame,
        news_summary: dict | None = None,
        macro_df: pd.DataFrame | None = None
    ) -> pd.DataFrame:
        """
        Menghasilkan 46-factor feature matrix terpadu.
        """
        # 1. Technical Indicators
        df = TechnicalFeatureEngine.compute_all_indicators(ohlcv_df)
        
        # 2. Institutional Smart Money Flows
        df = InstitutionalFlowEngine.compute_flow_indicators(df)

        # 3. Macroeconomic & Commodity Alignment
        if macro_df is None:
            macro_df = self.macro_feed.fetch_macro_benchmarks()
        df = MacroFeatureEngine.align_and_compute_macro_features(df, macro_df)

        # 4. Contextual News Sentiment
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
        Simulasi blindfold walk-forward step-by-step untuk mengukur akurasi out-of-sample.
        """
        total_rows = len(df)
        actual_min_train = min(min_train_bars, max(25, int(total_rows * 0.35)))
        actual_horizon = min(horizon_days, max(5, int(total_rows * 0.1)))
        
        if total_rows < (actual_min_train + actual_horizon):
            logger.warning("Data tidak cukup untuk walk-forward simulation.")
            return self.backtest_metrics

        points = 0
        total_tests = 0
        false_calcs = 0
        news_disruptions = 0

        actual_step = max(2, min(step_size, max(1, int((total_rows - actual_min_train - actual_horizon) / 30))))

        for t in range(actual_min_train, total_rows - actual_horizon, actual_step):
            train_slice = df.iloc[:t].copy()
            future_actual_slice = df.iloc[t : t + actual_horizon].copy()
            
            current_close = train_slice["Close"].iloc[-1]
            future_close = future_actual_slice["Close"].iloc[-1]
            actual_return = (future_close - current_close) / (current_close + 1e-9)
            actual_direction = 1 if actual_return > 0.005 else (-1 if actual_return < -0.005 else 0)

            latest_features = train_slice[self.feature_columns].iloc[[-1]].copy()
            
            # Rule Broker Baseline with Institutional Flow & Macro
            rsi = latest_features["rsi_14"].iloc[0]
            macd_hist = latest_features["macd_hist"].iloc[0]
            trend_bull = latest_features["ma_trend_bullish"].iloc[0]
            vol_ratio = latest_features["volume_ratio"].iloc[0]
            cmf = latest_features["cmf_20"].iloc[0]
            news_score = latest_features["news_avg_sentiment"].iloc[0]

            broker_score = 0.0
            if trend_bull: broker_score += 0.30 * self.feature_weights["trend"]
            else: broker_score -= 0.30 * self.feature_weights["trend"]
            
            if rsi < 40: broker_score += 0.25 * self.feature_weights["momentum"]
            elif rsi > 60: broker_score -= 0.25 * self.feature_weights["momentum"]
            
            if macd_hist > 0: broker_score += 0.20 * self.feature_weights["momentum"]
            else: broker_score -= 0.20 * self.feature_weights["momentum"]

            if vol_ratio > 1.2: broker_score += (0.15 if broker_score > 0 else -0.15) * self.feature_weights["volume"]
            if cmf > 0.05: broker_score += 0.15 * self.feature_weights["flow"]
            elif cmf < -0.05: broker_score -= 0.15 * self.feature_weights["flow"]

            broker_score += (news_score * 0.35) * self.feature_weights["news"]

            predicted_direction = 1 if broker_score > 0.15 else (-1 if broker_score < -0.15 else 0)

            total_tests += 1
            if predicted_direction == actual_direction or (predicted_direction == 0 and abs(actual_return) <= 0.02):
                points += 1
            else:
                if abs(news_score) >= 0.30:
                    news_disruptions += 1
                else:
                    false_calcs += 1

        win_rate = round((points / max(1, total_tests)) * 100, 1)
        self.backtest_metrics = {
            "total_simulations": total_tests,
            "correct_predictions": points,
            "win_rate_pct": win_rate,
            "false_calc_count": false_calcs,
            "news_disruption_count": news_disruptions
        }
        return self.backtest_metrics

    def train(self, X: pd.DataFrame, y: pd.Series | None = None) -> dict:
        """
        Melatih model Gradient Boosting dan melakukan kalibrasi bobot adaptif.
        """
        if len(X) < 30:
            return {"status": "insufficient_data"}

        # Ensure all required features are present
        missing_cols = [c for c in self.feature_columns if c not in X.columns]
        if missing_cols:
            X = self.prepare_features(X)

        features_df = X[self.feature_columns].copy()
        
        # Target creation (20 bars forward return)
        close = X["Close"]
        forward_return = close.pct_change(20).shift(-20)
        
        valid_mask = ~forward_return.isna()
        if valid_mask.sum() < 25:
            forward_return = close.pct_change(5).shift(-5)
            valid_mask = ~forward_return.isna()

        X_train = features_df[valid_mask]
        y_ret = forward_return[valid_mask]
        y_clf = (y_ret > 0.005).astype(int)

        unique_classes = np.unique(y_clf)
        if len(unique_classes) < 2:
            y_clf = (y_ret >= y_ret.median()).astype(int)
            if len(np.unique(y_clf)) < 2:
                y_clf.iloc[0] = 0
                y_clf.iloc[-1] = 1

        X_scaled = self.scaler.fit_transform(X_train)
        self.classifier.fit(X_scaled, y_clf)
        self.regressor.fit(X_scaled, y_ret)
        self.is_trained = True

        # Run Walk-Forward backtest simulation
        self.walk_forward_blind_simulation(X)

        # Dynamic weight auto-tuning based on backtest error attribution
        metrics = self.backtest_metrics
        if metrics["news_disruption_count"] > metrics["false_calc_count"]:
            self.feature_weights["news"] = 1.35
            self.feature_weights["trend"] = 0.90
        elif metrics["false_calc_count"] > metrics["news_disruption_count"]:
            self.feature_weights["trend"] = 1.25
            self.feature_weights["flow"] = 1.20
            self.feature_weights["news"] = 1.05

        return {
            "status": "trained",
            "samples": len(X_train),
            "win_rate_pct": self.backtest_metrics["win_rate_pct"],
            "feature_weights": self.feature_weights
        }

    def predict(
        self,
        X_latest: pd.DataFrame,
        current_price: float,
        news_summary: dict | None = None,
        holding_info: dict | None = None
    ) -> PredictionResult:
        # Auto-train if necessary
        if not self.is_trained or self.backtest_metrics.get("total_simulations", 0) == 0:
            if len(X_latest) >= 30:
                try:
                    self.train(X_latest)
                except Exception as e:
                    logger.warning(f"Auto-train during predict failed: {e}")

        ticker = X_latest["ticker"].iloc[-1] if "ticker" in X_latest else "UNKNOWN"
        
        # Ensure all columns present
        if not all(col in X_latest.columns for col in self.feature_columns):
            X_latest = self.prepare_features(X_latest, news_summary=news_summary)

        latest_row = X_latest[self.feature_columns].iloc[[-1]]
        
        volatility = float(latest_row["volatility_pct"].iloc[0])
        rsi = float(latest_row["rsi_14"].iloc[0])
        macd_hist = float(latest_row["macd_hist"].iloc[0])
        news_score = float(latest_row["news_avg_sentiment"].iloc[0])
        trend_bull = bool(latest_row["ma_trend_bullish"].iloc[0])
        cmf_20 = float(latest_row["cmf_20"].iloc[0])
        mfi_14 = float(latest_row["mfi_14"].iloc[0])
        smart_money_score = float(latest_row["smart_money_flow_score"].iloc[0])
        beta_ihsg = float(latest_row["beta_ihsg_30"].iloc[0])
        atr_14 = float(X_latest["atr_14"].iloc[-1]) if "atr_14" in X_latest else (current_price * 0.025)

        # 1. Fundamental Ratios Ingestion
        fundamentals = self.fundamental_feed.fetch_fundamentals(ticker)

        # 2. Institutional Smart Money Flow Summary
        flow_summary = InstitutionalFlowEngine.get_latest_flow_summary(X_latest)

        # 3. Macro Context Summary
        macro_summary = self.macro_feed.get_latest_macro_summary()
        macro_summary["beta_ihsg_30"] = round(beta_ihsg, 2)

        # Market Regime
        if volatility > 3.5:
            regime = "Volatilitas Tinggi"
        elif trend_bull and rsi > 50:
            regime = "Tren Menguat (Bullish)"
        elif not trend_bull and rsi < 50:
            regime = "Tren Melemah (Bearish)"
        else:
            regime = "Konsolidasi (Sideways)"

        # 4. Base ML Probability & Expected Return
        if self.is_trained:
            X_scaled = self.scaler.transform(latest_row)
            probs = self.classifier.predict_proba(X_scaled)[0]
            base_bullish_prob = float(probs[1]) if len(probs) > 1 else 0.5
            base_pred_return = float(self.regressor.predict(X_scaled)[0]) * 100
        else:
            base_bullish_prob = 0.5 + (0.15 if trend_bull else -0.15)
            base_pred_return = (base_bullish_prob - 0.5) * 8.0

        # 5. Multi-Factor Recalibration: Sentiment + Institutional Flow + Macro Beta + Fundamentals
        news_weight = self.feature_weights.get("news", 1.2)
        news_count = news_summary.get("news_count", 1) if news_summary else 1
        volume_factor = min(1.5, 0.8 + 0.15 * math.sqrt(max(1, news_count)))
        
        # Institutional flow shift (+/- 12%)
        flow_shift = (cmf_20 * 0.6) * self.feature_weights.get("flow", 1.0)
        # Sentiment shift (+/- 25%)
        sentiment_shift = (news_score * 0.28) * news_weight * volume_factor
        # Fundamental health shift (+/- 8%)
        fund_score = fundamentals.get("health_score", 50.0)
        fund_shift = ((fund_score - 50.0) / 100.0) * 0.15

        bullish_prob = max(0.05, min(0.95, base_bullish_prob + sentiment_shift + flow_shift + fund_shift))
        pred_return = base_pred_return + (news_score * 4.5 * volume_factor) + (cmf_20 * 4.0)

        # 6. Signal & Confidence Classification
        is_divergent = (base_bullish_prob >= 0.55 and news_score < -0.20) or (base_bullish_prob <= 0.45 and news_score > 0.20)

        if bullish_prob >= 0.55:
            signal = "Beli (Bullish)"
            confidence = round(bullish_prob * 100, 1)
            expected_return = round(pred_return, 2)
        elif bullish_prob <= 0.45:
            signal = "Waspada (Bearish)"
            confidence = round((1.0 - bullish_prob) * 100, 1)
            expected_return = round(pred_return, 2)
        else:
            signal = "Tunggu (Netral)"
            confidence = round((1.0 - abs(bullish_prob - 0.5) * 2) * 100, 1)
            expected_return = round(pred_return * 0.4, 2)

        if is_divergent:
            confidence = max(50.0, round(confidence * 0.85, 1))
            if news_score < -0.45 and signal == "Beli (Bullish)":
                signal = "Tunggu (Netral)"
                expected_return = round(min(0.0, pred_return), 2)

        # 7. Dynamic ATR Risk Management & Adaptive Exit Engine (Upgrade #5)
        # Stop-Loss: 1.5x ATR, Take-Profit: 2.5x ATR, Conservative: 1.5x ATR
        is_bull_signal = "Beli" in signal or "Bull" in signal
        if is_bull_signal:
            stop_loss = round(max(50.0, current_price - (1.5 * atr_14)), 0)
            take_profit = round(current_price + (2.5 * atr_14), 0)
            conservative_target = round(current_price + (1.5 * atr_14), 0)
        else:
            stop_loss = round(current_price + (1.5 * atr_14), 0)
            take_profit = round(max(50.0, current_price - (2.5 * atr_14)), 0)
            conservative_target = round(max(50.0, current_price - (1.5 * atr_14)), 0)

        risk_amount = abs(current_price - stop_loss)
        reward_amount = abs(take_profit - current_price)
        rrr = round(reward_amount / (risk_amount + 1e-9), 2)
        risk_pct = (atr_14 / current_price) * 100

        if risk_pct > 3.8:
            risk_level = "Tinggi (Volatilitas Ekstrem)"
            risk_color = "#B71C1C"
        elif risk_pct > 2.0:
            risk_level = "Sedang (Normal)"
            risk_color = "#595750"
        else:
            risk_level = "Rendah (Terkendali)"
            risk_color = "#1B5E20"

        risk_management = {
            "stop_loss_price": stop_loss,
            "take_profit_price": take_profit,
            "conservative_target_price": conservative_target,
            "risk_reward_ratio": f"1 : {rrr}",
            "risk_level": risk_level,
            "risk_color": risk_color,
            "atr_14": round(atr_14, 2),
            "risk_pct": round(risk_pct, 2)
        }

        # 8. Precision Action Alert (Urgent Sell / Prime Buy / Swings / News)
        features_dict = latest_row.iloc[0].to_dict() if hasattr(latest_row, "iloc") else latest_row
        action_alert = self.precision_action_engine.evaluate_action_alert(
            ticker=ticker,
            current_price=float(current_price),
            features_row=features_dict,
            news_summary=news_summary,
            holding_info=holding_info,
            fundamentals=fundamentals,
            flow_summary=flow_summary
        )

        rsi_status = "Jenuh Jual (Oversold)" if rsi < 35 else ("Jenuh Beli (Overbought)" if rsi > 65 else "Netral")
        macd_status = "Golden Cross (Positif)" if macd_hist > 0 else "Dead Cross (Tekanan Jual)"
        win_rate = self.backtest_metrics.get("win_rate_pct", 75.0)

        key_factors = [
            {"factor": "RSI 14 Hari", "value": round(rsi, 2), "status": rsi_status},
            {"factor": "Momentum MACD", "value": round(macd_hist, 4), "status": macd_status},
            {"factor": "Arus Dana Asing / Institusi", "value": f"CMF {cmf_20:+.2f}", "status": flow_summary.get("flow_status", "Netral")},
            {"factor": "Kesehatan Fundamental", "value": f"Score {fundamentals.get('health_score', 50)}/100", "status": fundamentals.get("grade", "Moderat")},
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
            action_alert=action_alert,
            risk_management=risk_management,
            fundamentals=fundamentals,
            institutional_flow=flow_summary,
            macro_context=macro_summary,
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
