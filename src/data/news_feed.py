import logging
import urllib.parse
import re
import feedparser
import pandas as pd

logger = logging.getLogger(__name__)

# Indonesian Stock Key Aliases for accurate news matching
TICKER_ALIASES = {
    "BBCA.JK": ["BBCA", "Bank BCA", "BCA", "Bank Central Asia"],
    "BBRI.JK": ["BBRI", "Bank BRI", "BRI", "Bank Rakyat Indonesia"],
    "BMRI.JK": ["BMRI", "Bank Mandiri", "Mandiri"],
    "BBNI.JK": ["BBNI", "Bank BNI", "BNI", "Bank Negara Indonesia"],
    "BRIS.JK": ["BRIS", "Bank Syariah Indonesia", "BSI"],
    "BBTN.JK": ["BBTN", "Bank Tabungan Negara", "BTN"],
    "ARTO.JK": ["ARTO", "Bank Jago"],
    "BDMN.JK": ["BDMN", "Bank Danamon"],
    "TLKM.JK": ["TLKM", "Telkom", "Telkom Indonesia", "Telkomsel"],
    "ISAT.JK": ["ISAT", "Indosat", "Indosat Ooredoo"],
    "EXCL.JK": ["EXCL", "XL Axiata", "XL"],
    "GOTO.JK": ["GOTO", "Gojek", "Tokopedia", "GoTo Gojek Tokopedia"],
    "BUKA.JK": ["BUKA", "Bukalapak"],
    "EMTK.JK": ["EMTK", "Elang Mahkota"],
    "ADRO.JK": ["ADRO", "Adaro", "Adaro Energy"],
    "PTBA.JK": ["PTBA", "Bukit Asam"],
    "ITMG.JK": ["ITMG", "Indo Tambangraya Megah"],
    "ANTM.JK": ["ANTM", "Antam", "Aneka Tambang", "Emas Antam"],
    "INCO.JK": ["INCO", "Vale Indonesia", "Vale"],
    "MDKA.JK": ["MDKA", "Merdeka Copper", "Merdeka Copper Gold"],
    "AMMN.JK": ["AMMN", "Amman Mineral"],
    "MEDC.JK": ["MEDC", "Medco Energi", "Medco"],
    "PGAS.JK": ["PGAS", "PGN", "Perusahaan Gas Negara"],
    "AKRA.JK": ["AKRA", "AKR Corporindo"],
    "BUMI.JK": ["BUMI", "Bumi Resources"],
    "BRPT.JK": ["BRPT", "Barito Pacific"],
    "TPIA.JK": ["TPIA", "Chandra Asri"],
    "ICBP.JK": ["ICBP", "Indofood CBP"],
    "INDF.JK": ["INDF", "Indofood"],
    "UNVR.JK": ["UNVR", "Unilever", "Unilever Indonesia"],
    "MYOR.JK": ["MYOR", "Mayora", "Mayora Indah"],
    "KLBF.JK": ["KLBF", "Kalbe", "Kalbe Farma"],
    "SIDO.JK": ["SIDO", "Sido Muncul"],
    "AMRT.JK": ["AMRT", "Alfamart", "Sumber Alfaria"],
    "MAPI.JK": ["MAPI", "Mitra Adiperkasa"],
    "ACES.JK": ["ACES", "Ace Hardware", "Aspirasi Hidup"],
    "CPIN.JK": ["CPIN", "Charoen Pokphand"],
    "JPFA.JK": ["JPFA", "Japfa Comfeed"],
    "GGRM.JK": ["GGRM", "Gudang Garam"],
    "HMSP.JK": ["HMSP", "Sampoerna"],
    "ASII.JK": ["ASII", "Astra", "Astra International"],
    "UNTR.JK": ["UNTR", "United Tractors"],
    "AUTO.JK": ["AUTO", "Astra Otoparts"],
    "SMGR.JK": ["SMGR", "Semen Indonesia"],
    "INTP.JK": ["INTP", "Indocement"],
    "CTRA.JK": ["CTRA", "Ciputra Development"],
    "BSDE.JK": ["BSDE", "Bumi Serpong Damai"],
    "PWON.JK": ["PWON", "Pakuwon Jati"],
    "SMRA.JK": ["SMRA", "Summarecon Agung"],
    "JSMR.JK": ["JSMR", "Jasa Marga"],
}

class NewsDataFeed:
    """
    Mengambil berita finansial dan katalis emiten saham Indonesia dengan foto berita asli (Real Article Thumbnails)
    yang beradaptasi secara spesifik untuk setiap emiten terpilih.
    """
    def __init__(self, lookback_days: int = 7):
        self.lookback_days = lookback_days

    def _extract_image_from_entry(self, entry) -> str | None:
        """Ekstraksi URL foto berita asli dari RSS tags."""
        # 1. Enclosures
        enclosures = getattr(entry, "enclosures", [])
        if enclosures:
            for enc in enclosures:
                if "image" in enc.get("type", "") or enc.get("href"):
                    return enc.get("href") or enc.get("url")
        
        # 2. Media thumbnail / content
        media_thumb = getattr(entry, "media_thumbnail", [])
        if media_thumb and len(media_thumb) > 0:
            return media_thumb[0].get("url")

        media_content = getattr(entry, "media_content", [])
        if media_content and len(media_content) > 0:
            return media_content[0].get("url")

        # 3. HTML Summary regex
        summary = getattr(entry, "summary", "")
        if summary:
            m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
            if m:
                return m.group(1)

        return None

    def fetch_news_for_ticker(self, ticker: str, max_articles: int = 15) -> pd.DataFrame:
        """
        Mengambil berita terkini dan foto artikel yang secara spesifik relevan dengan ticker saham.
        """
        articles = []
        clean_code = ticker.replace(".JK", "").strip()
        aliases = TICKER_ALIASES.get(ticker, [clean_code, f"saham {clean_code}"])

        # 1. Targeted Google News Indonesia Search for this exact ticker
        alias_query = " OR ".join([f'"{a}"' for a in aliases[:3]])
        query_id = f"saham {clean_code} OR ({alias_query}) OR {clean_code} dividen OR {clean_code} laba"
        encoded_query = urllib.parse.quote(query_id)
        google_rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=id&gl=ID&ceid=ID:id"
        yahoo_rss_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"

        for url in [google_rss_url, yahoo_rss_url]:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:max_articles]:
                    title = getattr(entry, "title", "")
                    summary = getattr(entry, "summary", "")
                    link = getattr(entry, "link", "")
                    published = getattr(entry, "published", "")
                    image_url = self._extract_image_from_entry(entry)

                    if title:
                        articles.append({
                            "ticker": ticker,
                            "title": title,
                            "summary": summary,
                            "link": link,
                            "published_at": published,
                            "image_url": image_url,
                            "source_feed": url,
                        })
            except Exception as e:
                logger.warning(f"Gagal mengambil RSS {url} untuk {ticker}: {e}")

        # 2. Match with direct Indonesian financial feeds ONLY if they strictly mention the ticker's aliases
        direct_urls = [
            "https://www.cnbcindonesia.com/market/rss",
            "https://www.antaranews.com/rss/ekonomi-bursa",
        ]
        for d_url in direct_urls:
            try:
                d_feed = feedparser.parse(d_url)
                for entry in d_feed.entries:
                    t = getattr(entry, "title", "")
                    t_lower = t.lower()
                    # Strictly check if any ticker alias is in the title
                    if any(a.lower() in t_lower for a in aliases):
                        articles.append({
                            "ticker": ticker,
                            "title": t,
                            "summary": getattr(entry, "summary", ""),
                            "link": getattr(entry, "link", ""),
                            "published_at": getattr(entry, "published", ""),
                            "image_url": self._extract_image_from_entry(entry),
                            "source_feed": d_url,
                        })
            except Exception as e:
                logger.warning(f"Gagal memeriksa direct feed {d_url}: {e}")

        if not articles:
            return pd.DataFrame(columns=["ticker", "title", "summary", "link", "published_at", "image_url", "source_feed"])

        df = pd.DataFrame(articles)
        df.drop_duplicates(subset=["title"], inplace=True)
        return df.head(max_articles)
