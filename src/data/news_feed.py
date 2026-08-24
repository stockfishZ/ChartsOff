import logging
import urllib.parse
import re
import feedparser
import pandas as pd

logger = logging.getLogger(__name__)

class NewsDataFeed:
    """
    Mengambil berita finansial dan katalis emiten saham Indonesia dari RSS Google News ID & Yahoo Finance.
    """
    def __init__(self, lookback_days: int = 7):
        self.lookback_days = lookback_days

    def fetch_news_for_ticker(self, ticker: str, max_articles: int = 15) -> pd.DataFrame:
        """
        Mengambil berita terkini untuk kode saham Indonesia (misal: BBCA, BBRI).
        """
        articles = []
        clean_code = ticker.replace(".JK", "").strip()
        
        # 1. Google News Indonesia untuk kode saham
        query_id = f"saham {clean_code} OR {clean_code} dividen OR {clean_code} laba"
        encoded_query = urllib.parse.quote(query_id)
        google_rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=id&gl=ID&ceid=ID:id"
        
        # 2. Yahoo Finance RSS
        yahoo_rss_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"

        for url in [google_rss_url, yahoo_rss_url]:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:max_articles]:
                    title = getattr(entry, "title", "")
                    summary = getattr(entry, "summary", "")
                    link = getattr(entry, "link", "")
                    published = getattr(entry, "published", "")
                    
                    # Extract image thumbnail from media tags or summary HTML
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
                            "source_feed": url
                        })
            except Exception as e:
                logger.warning(f"Gagal mengambil RSS dari {url} untuk {ticker}: {e}")

        if not articles:
            return pd.DataFrame(columns=["ticker", "title", "summary", "link", "published_at", "image_url", "source_feed"])

        df = pd.DataFrame(articles)
        df.drop_duplicates(subset=["title"], inplace=True)
        return df.head(max_articles)
