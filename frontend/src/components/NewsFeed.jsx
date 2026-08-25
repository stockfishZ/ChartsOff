import React, { useState, useEffect, useRef, useMemo } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";

// Curated high-quality editorial fallback thumbnails for Indonesian and global financial markets
const FALLBACK_THUMBNAILS = [
  "https://akcdn.detik.net.id/visual/2026/06/30/layar-menampilkan-pergerakan-indeks-harga-saham-gabungan-ihsg-di-bursa-efek-indonesia-bei-jakarta-selasa-3062026-1782797019138_169.jpeg?w=1200&q=90",
  "https://akcdn.detik.net.id/visual/2026/06/08/layar-menampilkan-pergerakan-indeks-harga-saham-gabungan-ihsg-di-gedung-bursa-efek-indonesia-bei-jakarta-senin-862026-cnbc-ind-1780893013553_169.jpeg?w=1200&q=90",
  "https://cdn.antaranews.com/cache/800x533/2026/08/14/pergerakan-indeks-harga-saham-gabungan-270726-dr-02.jpg",
  "https://akcdn.detik.net.id/community/media/visual/2026/08/24/bursa-dan-valas-1787534173-1787534173931.jpeg?w=360&q=90",
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=400&auto=format&fit=crop&q=80"
];

function getValidImageUrl(url, fallback) {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (trimmed === "" || trimmed === "nan" || trimmed === "None" || trimmed === "null") return fallback;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return fallback;
}

function NewsItem({ news, index }) {
  const fallbackUrl = FALLBACK_THUMBNAILS[index % FALLBACK_THUMBNAILS.length];
  const initialUrl = getValidImageUrl(news.image_url, fallbackUrl);
  const [imgSrc, setImgSrc] = useState(initialUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(getValidImageUrl(news.image_url, fallbackUrl));
    setHasError(false);
  }, [news.image_url, fallbackUrl]);

  const handleImageError = () => {
    if (!hasError && imgSrc !== fallbackUrl) {
      setImgSrc(fallbackUrl);
      setHasError(true);
    }
  };

  // Clean publisher source name if available in title (e.g. "Judul Berita - CNBC Indonesia")
  let displayTitle = news.title || "Berita Pasar Modal Terkini";
  let sourceName = "Berita Pasar";
  if (displayTitle.includes(" - ")) {
    const parts = displayTitle.split(" - ");
    sourceName = parts.pop();
    displayTitle = parts.join(" - ");
  }

  return (
    <a
      href={news.link || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="py-3 px-1.5 flex items-start space-x-3 group hover:bg-[#FAF9F6] active:bg-[#F1EFEA] transition"
    >
      {/* Left: Authentic Article Image Thumbnail */}
      <div className="w-[76px] h-[76px] sm:w-20 sm:h-20 shrink-0 border border-[#121316] bg-[#FAF9F6] overflow-hidden relative shadow-xs">
        <img
          src={imgSrc}
          alt={displayTitle}
          onError={handleImageError}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition" />
      </div>

      {/* Right: Content & Metadata */}
      <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch">
        <div>
          <div className="flex items-center justify-between space-x-1 mb-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#737168] bg-[#F1EFEA] px-1 py-0.2 border border-[#DCDAD4] truncate max-w-[150px]">
              {sourceName}
            </span>
            <ExternalLink className="w-3 h-3 text-[#A8A59C] group-hover:text-[#121316] shrink-0" />
          </div>

          <h4 className="font-editorial font-bold text-xs sm:text-sm text-[#121316] group-hover:underline line-clamp-2 leading-snug">
            {displayTitle}
          </h4>
        </div>

        <span className="text-[10px] font-mono text-[#737168] block mt-1.5">
          {news.published_at || "Terkini"}
        </span>
      </div>
    </a>
  );
}

export default function NewsFeed({ ticker, newsSentiment }) {
  const [headlines, setHeadlines] = useState(() => newsSentiment?.top_headlines || []);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  // Synchronize when initial newsSentiment changes
  useEffect(() => {
    if (newsSentiment?.top_headlines?.length) {
      setHeadlines(newsSentiment.top_headlines);
      setLastUpdated(new Date());
    }
  }, [newsSentiment]);

  // Automated Real-Time Article Renewing Engine
  const fetchLiveNews = async (silent = false) => {
    if (!ticker) return;
    const cleanTicker = ticker.replace(".JK", "").trim();
    if (!silent) setIsUpdating(true);

    try {
      let data = null;
      try {
        const res = await fetch(`/api/news/${cleanTicker}`);
        if (res.ok) data = await res.json();
      } catch (e) {}

      if (!data || !data.top_headlines || data.top_headlines.length === 0) {
        const host = window.location.hostname || "localhost";
        try {
          const directRes = await fetch(`http://${host}:8000/api/news/${cleanTicker}`);
          if (directRes.ok) data = await directRes.json();
        } catch (e) {}
      }

      if (data && Array.isArray(data.top_headlines) && data.top_headlines.length > 0) {
        setHeadlines(data.top_headlines);
        setLastUpdated(new Date());
      }
    } catch (err) {
      // Graceful fallback to cached headlines
    } finally {
      if (!silent) setIsUpdating(false);
    }
  };

  // Trigger live fetch when stock ticker changes
  useEffect(() => {
    fetchLiveNews(false);
  }, [ticker]);

  // Automated recurring news poll every 3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveNews(true);
    }, 180000); // 3 minutes
    return () => clearInterval(interval);
  }, [ticker]);

  const cleanTicker = ticker ? ticker.replace(".JK", "").trim() : "Saham";

  // Sort articles descending by timestamp (freshest and newest articles at the top)
  const sortedHeadlines = useMemo(() => {
    if (!headlines || !Array.isArray(headlines)) return [];
    return [...headlines].sort((a, b) => {
      const parseDate = (d) => {
        if (!d || typeof d !== "string") return 0;
        if (d.toLowerCase().includes("terkini")) return Date.now();
        const parsed = Date.parse(d);
        return isNaN(parsed) ? 0 : parsed;
      };
      return parseDate(b.published_at) - parseDate(a.published_at);
    });
  }, [headlines]);

  if (!sortedHeadlines || sortedHeadlines.length === 0) return null;

  return (
    <div className="bg-white border border-[#121316] p-4 mb-20">
      {/* Header Panel with Live Updating Status */}
      <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2.5 mb-2">
        <div className="flex items-center space-x-1.5">
          <Newspaper className="w-4 h-4 text-[#121316]" />
          <span className="font-mono text-xs font-bold uppercase text-[#121316]">
            Berita Berkaitan dengan {cleanTicker}
          </span>
        </div>

        {/* Live Renewal Indicator */}
        <button
          type="button"
          onClick={() => fetchLiveNews(false)}
          className="flex items-center space-x-1 text-[10px] font-mono text-[#1B5E20] hover:underline cursor-pointer"
          title="Klik untuk memperbarui berita secara langsung"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#1B5E20] animate-pulse"></span>
          <span>{isUpdating ? "Memperbarui..." : "Live Update"}</span>
          <RefreshCw className={`w-2.5 h-2.5 ml-0.5 text-[#737168] ${isUpdating ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* News Article List */}
      <div className="divide-y divide-[#E5E3DC]">
        {sortedHeadlines.slice(0, 8).map((news, idx) => (
          <NewsItem key={`${news.link}-${idx}`} news={news} index={idx} />
        ))}
      </div>
    </div>
  );
}
