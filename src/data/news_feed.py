import logging
import urllib.parse
import re
import feedparser
import pandas as pd

logger = logging.getLogger(__name__)

class NewsDataFeed:
    """
    Mengambil berita finansial dan katalis emiten saham Indonesia dengan foto berita asli (Real Article Thumbnails)
    dari CNBC Indonesia, Antara News Bursa, Yahoo Finance, dan Google News ID.
    """
    def __init__(self, lookback_days: int = 7):
        self.lookback_days = lookback_days
        self._cached_market_feeds = None

    def _fetch_direct_market_feeds(self):
        """Mengambil feed berita pasar langsung yang memiliki foto artikel asli (100% genuine)."""
        feed_urls = [
            "https://www.cnbcindonesia.com/market/rss",
            "https://www.antaranews.com/rss/ekonomi-bursa",
            "https://feeds.finance.yahoo.com/rss/2.0/headline?region=US&lang=en-US",
        ]
        all_entries = []
        for url in feed_urls:
            try:
                f = feedparser.parse(url)
                for entry in f.entries:
                    title = getattr(entry, "title", "")
                    link = getattr(entry, "link", "")
                    summary = getattr(entry, "summary", "")
                    published = getattr(entry, "published", "")
                    
                    # Extract authentic real photo
                    img = None
                    enclosures = getattr(entry, "enclosures", [])
                    if enclosures:
                        img = enclosures[0].get("href") or enclosures[0].get("url")
                    if not img:
                        media_thumb = getattr(entry, "media_thumbnail", [])
                        if media_thumb:
                            img = media_thumb[0].get("url")
                    if not img and summary:
                        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
                        if m:
                            img = m.group(1)

                    if title:
                        all_entries.append({
                            "title": title,
                            "summary": summary,
                            "link": link,
                            "published_at": published,
                            "image_url": img,
                            "source_feed": url,
                        })
            except Exception as e:
                logger.warning(f"Gagal mengambil direct feed {url}: {e}")
        return all_entries

    def fetch_news_for_ticker(self, ticker: str, max_articles: int = 15) -> pd.DataFrame:
        """
        Mengambil berita terkini dan foto artikel untuk kode saham Indonesia (misal: BBCA, BBRI).
        """
        articles = []
        clean_code = ticker.replace(".JK", "").strip()

        # 1. Check direct market feeds with real photography
        direct_entries = self._fetch_direct_market_feeds()
        for e in direct_entries:
            title_lower = e["title"].lower()
            code_lower = clean_code.lower()
            if code_lower in title_lower or "ihsg" in title_lower or "dividen" in title_lower or "bursa" in title_lower:
                articles.append({
                    "ticker": ticker,
                    "title": e["title"],
                    "summary": e["summary"],
                    "link": e["link"],
                    "published_at": e["published_at"],
                    "image_url": e["image_url"],
                    "source_feed": e["source_feed"],
                })

        # 2. Specific Google News RSS search for this ticker
        query_id = f"saham {clean_code} OR {clean_code} dividen OR {clean_code} laba"
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
                    
                    image_url = None
                    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
                        image_url = entry.media_thumbnail[0].get("url")
                    elif hasattr(entry, "media_content") and entry.media_content:
                        image_url = entry.media_content[0].get("url")
                    elif hasattr(entry, "enclosures") and entry.enclosures:
                        for enc in entry.enclosures:
                            if "image" in enc.get("type", ""):
                                image_url = enc.get("href") or enc.get("url")
                                break
                    if not image_url and summary:
                        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
                        if img_match:
                            image_url = img_match.group(1)

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

        if not articles:
            return pd.DataFrame(columns=["ticker", "title", "summary", "link", "published_at", "image_url", "source_feed"])

        df = pd.DataFrame(articles)
        df.drop_duplicates(subset=["title"], inplace=True)
        return df.head(max_articles)
