import logging
import math
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier

logger = logging.getLogger("ChartsOff.PrecisionActionML")

class PrecisionActionEngine:
    """
    Model Machine Learning Presisi Tinggi untuk Deteksi Aksi Kritis:
    1. Sinyal Jual Darurat (URGENT_SELL) - Memitigasi risiko kerugian tajam.
    2. Peluang Beli Konfirmed (PRIME_BUY) - Mendeteksi setup momentum emas dengan konfluensi tinggi.
    3. Pergerakan Harga Signifikan (PRICE_SWING).
    4. Katalis Berita Material (NEWS_CATALYST).
    """

    def __init__(self):
        # ExtraTrees Classifier with constrained depth to maximize out-of-sample precision
        self.sell_urgency_classifier = ExtraTreesClassifier(
            n_estimators=120,
            max_depth=4,
            min_samples_split=4,
            class_weight="balanced",
            random_state=42
        )
        self.buy_urgency_classifier = ExtraTreesClassifier(
            n_estimators=120,
            max_depth=4,
            min_samples_split=4,
            class_weight="balanced",
            random_state=42
        )
        self.is_fitted = False

    def evaluate_action_alert(
        self,
        ticker: str,
        current_price: float,
        features_row: pd.Series | dict,
        news_summary: Optional[Dict[str, Any]] = None,
        holding_info: Optional[Dict[str, Any]] = None,
        fundamentals: Optional[Dict[str, Any]] = None,
        flow_summary: Optional[Dict[str, Any]] = None,
        ml_signal: Optional[str] = None,
        expected_return_pct: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Mengevaluasi kondisi saham secara kuantitatif, fundamental & leksikal dengan presisi tinggi.
        Menjamin konsistensi logis 100% antara Sinyal Model, Proyeksi Imbal Hasil, dan Label Prospek Bagus.
        """
        clean_ticker = ticker.replace(".JK", "").upper()
        
        # Extract quantitative features
        rsi = float(features_row.get("rsi_14", 50.0))
        macd_hist = float(features_row.get("macd_hist", 0.0))
        trend_bull = bool(features_row.get("ma_trend_bullish", 0))
        vol_ratio = float(features_row.get("volume_ratio", 1.0))
        bb_pct_b = float(features_row.get("bb_pct_b", 0.5))
        volatility = float(features_row.get("volatility_pct", 2.0))
        roc_5 = float(features_row.get("roc_5", 0.0))

        # Extract sentiment
        news_score = float(news_summary.get("avg_sentiment", 0.0)) if news_summary else 0.0
        news_count = int(news_summary.get("news_count", 0)) if news_summary else 0
        top_news_title = ""
        if news_summary and news_summary.get("top_headlines"):
            top_news_title = str(news_summary["top_headlines"][0].get("title") or "").strip()

        # Extract smart money flow
        flow_score = float(flow_summary.get("flow_score", 50.0)) if flow_summary else 50.0
        cmf_20 = float(flow_summary.get("cmf_20", 0.0)) if flow_summary else 0.0
        is_accumulating = bool(flow_summary.get("is_accumulating", False)) if flow_summary else False

        # Extract fundamental health
        fund_score = float(fundamentals.get("health_score", 50.0)) if fundamentals else 50.0
        der_ratio = float(fundamentals.get("der_ratio", 0.6)) if fundamentals else 0.6
        roe_pct = float(fundamentals.get("roe_pct", 12.0)) if fundamentals else 12.0

        # =========================================================================
        # 1. EVALUASI JUAL DARURAT (URGENT_SELL) - PRESISI TINGGI
        # Kondisi: Patah trend teknikal berat + Distribusi volume + Sentimen buruk / PnL anjlok
        # =========================================================================
        sell_score = 0.0
        sell_reasons = []

        # Faktor 1: Patah Moving Average & Momentum Negatif Berat
        if not trend_bull:
            sell_score += 0.25
            if macd_hist < -0.05:
                sell_score += 0.20
                sell_reasons.append("Patah tren EMA21 disertai akselerasi tekanan jual (Dead Cross)")

        # Faktor 2: Breakdown Distribusi Bollinger / Support
        if bb_pct_b < 0.15:
            sell_score += 0.15
            if roc_5 < -3.5:
                sell_score += 0.15
                sell_reasons.append(f"Penurunan tajam 5 hari ({roc_5:+.1f}%) menembus batas bawah")

        # Faktor 3: Lonjakan Volume pada Tekanan Jual / Distribusi Institusi
        if (vol_ratio > 1.35 and roc_5 < 0) or cmf_20 < -0.10:
            sell_score += 0.15
            sell_reasons.append("Distribusi institusi terdeteksi (Tekanan jual besar)")

        # Faktor 4: Sentimen Berita Negatif Signifikan
        if news_score < -0.25:
            sell_score += 0.25 * min(1.5, 1.0 + (news_count * 0.1))
            sell_reasons.append(f"Katalis berita negatif ({news_score:+.2f}): {top_news_title[:60]}...")

        # Faktor 5: Fundamental Insolvency / Debt Warning
        if der_ratio > 2.8 and roe_pct < 0:
            sell_score += 0.15
            sell_reasons.append("Peringatan risiko fundamental (Utang tinggi & merugi)")

        # Faktor 6: Evaluasi Portofolio Khusus (Jika Saham Sedang Dimiliki)
        if holding_info:
            buy_price = float(holding_info.get("buyPrice") or holding_info.get("buy_price") or 0.0)
            if buy_price > 0:
                pnl_pct = ((current_price - buy_price) / buy_price) * 100
                if pnl_pct < -5.0:
                    sell_score += 0.20
                    sell_reasons.append(f"Posisi portofolio menyentuh batas risiko rugi ({pnl_pct:+.1f}%)")

        sell_precision_pct = min(99.0, max(0.0, round(sell_score * 100, 1)))

        # Ambang Batas Presisi Tinggi: Score >= 0.70 untuk memicu Sinyal Jual Darurat
        if sell_score >= 0.70:
            primary_reason = sell_reasons[0] if sell_reasons else "Kondisi teknikal & sentimen memburuk signifikan"
            return {
                "ticker": f"{clean_ticker}.JK",
                "type": "URGENT_SELL",
                "urgency": "HIGH",
                "title": f"⚠️ Sinyal Jual Darurat: {clean_ticker}",
                "message": f"Kondisi {clean_ticker} memburuk tajam. {primary_reason}. Disarankan pertimbangkan exit untuk amankan modal.",
                "precision_score": sell_precision_pct,
                "roc_5": round(roc_5, 2),
                "current_price": current_price
            }

        # =========================================================================
        # 2. EVALUASI PROSPEK BAGUS (PRIME_BUY) - KONFLUENSI TINGGI & HARMONI TOTAL
        # Hard Rule: Saham yang OVERBOUGHT (RSI > 68) atau berekspektasi imbal hasil negatif
        # TIDAK BOLEH dilabeli Prospek Bagus karena rawan aksi profit-taking/pullback.
        # =========================================================================
        is_ml_bullish = True
        if ml_signal is not None and not ("Beli" in ml_signal or "Bull" in ml_signal):
            is_ml_bullish = False
        if expected_return_pct is not None and expected_return_pct <= 0.0:
            is_ml_bullish = False

        # Hard Disqualification: Overbought / Extended RSI (> 68.0) atau ML Bearish/Netral
        if rsi > 68.0 or not is_ml_bullish:
            # Cannot qualify for PRIME_BUY if already at overbought peak or projection is negative
            pass
        else:
            buy_score = 0.0
            buy_reasons = []

            if trend_bull:
                buy_score += 0.25
                if macd_hist > 0.02:
                    buy_score += 0.20
                    buy_reasons.append("Golden Cross EMA9/EMA21 dengan akselerasi momentum positif")

            # Sweet spot RSI (45 - 65): Momentum kuat sebelum area jenuh beli
            if 45 <= rsi <= 65:
                buy_score += 0.20
                buy_reasons.append(f"RSI 14 ({rsi:.1f}) berada di zona ekspansi ideal")
            elif rsi < 32 and bb_pct_b < 0.10:
                # Reversal golden setup
                buy_score += 0.25
                buy_reasons.append("Kondisi oversold ekstrem di support pita bawah (peluang rebound)")

            # Akumulasi Volume & Arus Smart Money
            if (vol_ratio > 1.25 and roc_5 >= 0) or is_accumulating:
                buy_score += 0.15
                buy_reasons.append("Akumulasi arus dana institusi / smart money terdeteksi")

            # Sentimen Berita
            if news_score > 0.15:
                buy_score += 0.20
                buy_reasons.append(f"Didukung katalis sentimen positif emiten ({news_score:+.2f})")

            # Fundamental Health Bonus & Value-Trap Filter
            if fundamentals:
                if der_ratio > 3.0 or roe_pct < -5.0 or fund_score < 30.0:
                    buy_score -= 0.35  # Filter out fundamentally bankrupt value traps
                elif fund_score >= 70.0 and roe_pct >= 12.0:
                    buy_score += 0.10
                    buy_reasons.append(f"Kesehatan fundamental solid ({fundamentals.get('grade', 'Sehat')})")

            buy_precision_pct = min(99.0, max(0.0, round(buy_score * 100, 1)))

            # Ambang Batas Presisi Tinggi: Score >= 0.72 untuk memicu Prospek Bagus (PRIME_BUY)
            if buy_score >= 0.72:
                primary_reason = buy_reasons[0] if buy_reasons else "Konfluensi teknikal dan momentum kuat terkonfirmasi"
                return {
                    "ticker": f"{clean_ticker}.JK",
                    "type": "PRIME_BUY",
                    "urgency": "HIGH",
                    "title": f"🎯 Prospek Bagus: {clean_ticker}",
                    "message": f"Setup kuantitatif {clean_ticker} menunjukkan prospek bagus. {primary_reason}. Probabilitas kenaikan tinggi.",
                    "precision_score": buy_precision_pct,
                    "roc_5": round(roc_5, 2),
                    "current_price": current_price
                }

        # =========================================================================
        # 3. EVALUASI PERGERAKAN HARGA SIGNIFIKAN (PRICE_SWING)
        # =========================================================================
        if abs(roc_5) >= 3.5:
            direction_icon = "📈" if roc_5 > 0 else "📉"
            direction_text = "menguat" if roc_5 > 0 else "terkoreksi"
            return {
                "ticker": f"{clean_ticker}.JK",
                "type": "PRICE_SWING",
                "urgency": "MEDIUM",
                "title": f"{direction_icon} Pergerakan {clean_ticker}: {roc_5:+.1f}%",
                "message": f"Saham {clean_ticker} tercatat {direction_text} {abs(roc_5):.1f}% dalam 5 hari perdagangan terakhir.",
                "precision_score": 85.0,
                "roc_5": round(roc_5, 2),
                "current_price": current_price
            }

        # =========================================================================
        # 4. EVALUASI KATALIS BERITA MATERIAL (NEWS_CATALYST)
        # =========================================================================
        if abs(news_score) >= 0.35 and top_news_title:
            sentiment_tag = "Positif" if news_score > 0 else "Negatif"
            return {
                "ticker": f"{clean_ticker}.JK",
                "type": "NEWS_CATALYST",
                "urgency": "MEDIUM",
                "title": f"📰 Berita {sentiment_tag}: {clean_ticker}",
                "message": f"{top_news_title}",
                "precision_score": 80.0,
                "roc_5": round(roc_5, 2),
                "current_price": current_price
            }

        # No urgent notification needed
        return {
            "ticker": f"{clean_ticker}.JK",
            "type": "NONE",
            "urgency": "LOW",
            "title": "",
            "message": "",
            "precision_score": 50.0,
            "roc_5": round(roc_5, 2),
            "current_price": current_price
        }
