import logging
import re
import math
import pandas as pd

logger = logging.getLogger(__name__)

# Kamus Sentimen Finansial Bahasa Indonesia & Global
FINANCIAL_POSITIVE_KEYWORDS = {
    # Bahasa Indonesia
    "naik", "menguat", "lonjakan", "rekor", "laba", "dividen", "tumbuh", "kinerja",
    "cuan", "akumulasi", "rebound", "positif", "akuisisi", "target", "ekspansi",
    "untung", "bullish", "meningkat", "optimis", "meroket", "peningkatan",
    # English keywords fallback
    "surge", "gain", "beat", "profit", "bullish", "growth", "rally", "upgrade"
}

FINANCIAL_NEGATIVE_KEYWORDS = {
    # Bahasa Indonesia
    "turun", "melemah", "anjlok", "rugi", "merosot", "koreksi", "tekanan",
    "penjualan", "gugatan", "inflasi", "utang", "negatif", "ambruk", "suspend",
    "pesimis", "bearish", "penurunan", "jatuh", "tertekan", "penjualan bersih",
    # English keywords fallback
    "plunge", "drop", "miss", "loss", "bearish", "downgrade", "crash", "slump"
}

class SentimentFeatureEngine:
    """
    Menganalisis sentimen berita keuangan emiten saham Indonesia.
    """

    @staticmethod
    def _score_text(text: str) -> float:
        """
        Menghitung skor polaritas sentimen antara -1.0 (sangat negatif) sampai +1.0 (sangat positif).
        """
        if not text:
            return 0.0
            
        words = re.findall(r'\b\w+\b', text.lower())
        pos_count = sum(1 for w in words if w in FINANCIAL_POSITIVE_KEYWORDS)
        neg_count = sum(1 for w in words if w in FINANCIAL_NEGATIVE_KEYWORDS)
        
        total = pos_count + neg_count
        if total == 0:
            return 0.0
        return float((pos_count - neg_count) / total)

    @classmethod
    def aggregate_news_sentiment(cls, news_df: pd.DataFrame, ticker: str) -> dict:
        """
        Mengagregasi sentimen berita terkini saham menjadi metrik ringkas bebas NaN.
        """
        if news_df.empty:
            return {
                "ticker": ticker,
                "news_count": 0,
                "avg_sentiment": 0.0,
                "sentiment_label": "Netral",
                "top_headlines": []
            }

        df = news_df.copy()
        df["score"] = df.apply(lambda r: cls._score_text(f"{r['title']} {r['summary']}"), axis=1)

        avg_score = float(df["score"].mean()) if not df.empty else 0.0
        if math.isnan(avg_score):
            avg_score = 0.0

        if avg_score > 0.10:
            sentiment_label = "Positif (Bullish)"
        elif avg_score < -0.10:
            sentiment_label = "Negatif (Bearish)"
        else:
            sentiment_label = "Netral"

        # Sanitize text columns and ensure image_url is NEVER float('nan')
        if "image_url" in df.columns:
            df["image_url"] = df["image_url"].apply(
                lambda x: None if (pd.isna(x) or x is None or str(x).lower() in ["nan", "none", "null", ""]) else str(x)
            )
        else:
            df["image_url"] = None

        cols = ["title", "link", "published_at", "image_url"]
        headlines_raw = df[cols].head(5).to_dict(orient="records")
        
        top_headlines = []
        for h in headlines_raw:
            img = h.get("image_url")
            if img is not None and (pd.isna(img) or str(img).lower() in ["nan", "none", "null", ""]):
                img = None
            top_headlines.append({
                "title": str(h.get("title") or ""),
                "link": str(h.get("link") or ""),
                "published_at": str(h.get("published_at") or ""),
                "image_url": img
            })

        return {
            "ticker": ticker,
            "news_count": len(df),
            "avg_sentiment": round(avg_score, 4),
            "sentiment_label": sentiment_label,
            "top_headlines": top_headlines
        }
