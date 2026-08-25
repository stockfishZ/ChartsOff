import logging
import re
import math
from typing import Dict, Any, List, Optional
import pandas as pd
from src.data.news_feed import resolve_article_thumbnail

logger = logging.getLogger(__name__)

# Kamus Sentimen Finansial Bahasa Indonesia & Global
FINANCIAL_POSITIVE_KEYWORDS = {
    # Bahasa Indonesia
    "naik", "menguat", "lonjakan", "rekor", "laba", "dividen", "tumbuh", "bertumbuh", "kinerja",
    "cuan", "akumulasi", "rebound", "positif", "akuisisi", "target", "ekspansi", "keuntungan",
    "untung", "bullish", "meningkat", "optimis", "meroket", "peningkatan", "efisien", "pertumbuhan",
    "dividen interim", "pendapatan naik", "laba bersih", "keuntungan", "kerja sama", "laba usaha",
    "kenaikan", "terbang", "melesat", "kinerja positif", "surplus",
    # English keywords
    "surge", "gain", "beat", "profit", "bullish", "growth", "rally", "upgrade", "dividend",
    "outperform", "buy", "expansion"
}

FINANCIAL_NEGATIVE_KEYWORDS = {
    # Bahasa Indonesia
    "turun", "melemah", "anjlok", "rugi", "merugi", "merosot", "koreksi", "tekanan",
    "penjualan", "gugatan", "inflasi", "utang", "negatif", "ambruk", "suspend", "suspensi",
    "pesimis", "bearish", "penurunan", "jatuh", "tertekan", "pailit", "pkpu", "defisit",
    "gagal bayar", "sanksi", "penurunan tajam", "rugi bersih", "beban utang", "anjloknya",
    # English keywords
    "plunge", "drop", "miss", "loss", "bearish", "downgrade", "crash", "slump", "debt",
    "default", "lawsuit", "bankruptcy"
}

# Partikel Negasi (Membalik Polaritas Kata Berikutnya)
NEGATION_PARTICLES = {
    "tidak", "tak", "belum", "bukan", "gagal", "tanpa", "hilang", "batal", "nihil",
    "kurang", "bukanlah", "tiada", "not", "no", "never", "failed", "unable", "without"
}

# Penguat Intensitas (Amplify Magnitude)
INTENSIFIERS = {
    "sangat", "melesat", "rekor", "drastis", "tajam", "luar biasa", "terbang",
    "ambruk", "anjlok", "ekstrem", "signifikan", "masif", "huge", "massive", "drastic"
}

class SentimentFeatureEngine:
    """
    Mesin Analisis Sentimen NLP Finansial Kontekstual Lanjutan.
    Mendukung deteksi negasi (misal 'tidak bertumbuh' vs 'bertumbuh'),
    pembobotan intensitas leksikal, serta kategorisasi katalis emiten (Laba, Dividen, Utang).
    """

    @staticmethod
    def _score_text_contextual(text: str) -> float:
        """
        Menghitung skor polaritas sentimen berbasis konteks n-gram (-1.0 s.d +1.0)
        dengan penanganan negasi dan kata penguat.
        """
        if not text:
            return 0.0

        words = re.findall(r'\b[\w-]+\b', text.lower())
        if not words:
            return 0.0

        total_score = 0.0
        match_count = 0

        for i, word in enumerate(words):
            # Check previous 1 to 3 words for negation particles
            lookback_start = max(0, i - 3)
            preceding_tokens = words[lookback_start:i]
            is_negated = any(p in NEGATION_PARTICLES for p in preceding_tokens)
            is_intensified = any(p in INTENSIFIERS for p in preceding_tokens) or (word in INTENSIFIERS)
            weight = 1.5 if is_intensified else 1.0

            if word in FINANCIAL_POSITIVE_KEYWORDS:
                if is_negated:
                    total_score -= (1.0 * weight)  # e.g., "tidak bertumbuh" -> negative
                else:
                    total_score += (1.0 * weight)
                match_count += 1

            elif word in FINANCIAL_NEGATIVE_KEYWORDS:
                if is_negated:
                    total_score += (0.8 * weight)  # e.g., "tidak rugi" -> positive
                else:
                    total_score -= (1.0 * weight)
                match_count += 1

        if match_count == 0:
            return 0.0

        raw_score = total_score / (match_count + 1.0)
        return float(max(-1.0, min(1.0, raw_score)))

    @classmethod
    def categorize_article_catalyst(cls, title: str, snippet: str = "") -> str:
        """
        Mengkategorikan jenis katalis berita emiten.
        """
        combined = f"{title} {snippet}".lower()
        if any(w in combined for w in ["dividen", "dividend", "cum date", "yield"]):
            return "DIVIDEN"
        if any(w in combined for w in ["laba", "rugi", "profit", "pendapatan", "kinerja", "quarter", "ebitda"]):
            return "KINERJA_KEUANGAN"
        if any(w in combined for w in ["utang", "pkpu", "gugatan", "sanksi", "suspend", "pailit", "default"]):
            return "RISIKO_HUKUM_UTANG"
        if any(w in combined for w in ["akuisisi", "ekspansi", "pabrik", "kontrak", "tender", "investasi"]):
            return "EKSPANSI_BISNIS"
        return "BERITA_UMUM"

    @classmethod
    def aggregate_news_sentiment(cls, news_df: pd.DataFrame, ticker: str) -> dict:
        """
        Mengagregasi sentimen berita terkini saham menjadi metrik ringkas bebas NaN
        dengan thumbnail foto artikel dan tag katalis otomatis.
        """
        clean_ticker = ticker.upper().strip()
        if not clean_ticker.endswith(".JK"):
            clean_ticker += ".JK"

        if news_df is None or news_df.empty:
            return {
                "ticker": clean_ticker,
                "news_count": 0,
                "avg_sentiment": 0.0,
                "sentiment_label": "Netral (Minim Berita)",
                "catalyst_tag": "BERITA_UMUM",
                "top_headlines": []
            }

        # Filter news related to ticker (if ticker column exists)
        if "ticker" in news_df.columns:
            ticker_base = clean_ticker.replace(".JK", "")
            mask = news_df["ticker"].astype(str).str.upper().str.contains(ticker_base, na=False)
            ticker_news = news_df[mask].copy()
            if ticker_news.empty:
                ticker_news = news_df.copy()
        else:
            ticker_news = news_df.copy()

        if ticker_news.empty:
            return {
                "ticker": clean_ticker,
                "news_count": 0,
                "avg_sentiment": 0.0,
                "sentiment_label": "Netral (Minim Berita)",
                "catalyst_tag": "BERITA_UMUM",
                "top_headlines": []
            }

        scores = []
        headlines = []
        catalyst_counts = {}

        for idx, (_, row) in enumerate(ticker_news.iterrows()):
            title = str(row.get("title", ""))
            snippet = str(row.get("snippet", row.get("summary", "")))
            score = cls._score_text_contextual(f"{title} {snippet}")
            scores.append(score)

            catalyst = cls.categorize_article_catalyst(title, snippet)
            catalyst_counts[catalyst] = catalyst_counts.get(catalyst, 0) + 1

            img_url = str(row.get("image_url", ""))
            headlines.append({
                "title": title,
                "link": str(row.get("link", "#")),
                "published_at": str(row.get("published_at", "")),
                "image_url": resolve_article_thumbnail(ticker=clean_ticker, title=title, index=idx, extracted_url=img_url),
                "sentiment_score": round(score, 3),
                "catalyst_tag": catalyst
            })

        avg_score = float(sum(scores) / len(scores)) if scores else 0.0
        avg_score = max(-1.0, min(1.0, avg_score))

        if avg_score >= 0.15:
            sentiment_label = "Positif (Bullish)"
        elif avg_score <= -0.15:
            sentiment_label = "Negatif (Waspada Tekanan)"
        else:
            sentiment_label = "Netral / Berimbang"

        dominant_catalyst = max(catalyst_counts, key=catalyst_counts.get) if catalyst_counts else "BERITA_UMUM"

        return {
            "ticker": clean_ticker,
            "news_count": len(ticker_news),
            "avg_sentiment": round(avg_score, 4),
            "sentiment_label": sentiment_label,
            "catalyst_tag": dominant_catalyst,
            "top_headlines": headlines[:5]
        }
