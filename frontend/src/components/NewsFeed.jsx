import React from "react";
import { ExternalLink } from "lucide-react";

export default function NewsFeed({ newsSentiment }) {
  if (!newsSentiment || !newsSentiment.top_headlines?.length) return null;

  return (
    <div className="bg-white border border-[#121316] p-4 mb-20">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase text-[#121316]">Sentimen Berita & Katalis Emiten</span>
        <span className="text-[10px] font-mono text-[#737168]">{newsSentiment.top_headlines.length} Berita</span>
      </div>

      <div className="divide-y divide-[#E5E3DC]">
        {newsSentiment.top_headlines.slice(0, 4).map((news, idx) => (
          <a
            key={idx}
            href={news.link}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 block group hover:bg-[#FAF9F6] transition px-1"
          >
            <div className="flex items-start justify-between space-x-2">
              <span className="font-editorial text-sm font-semibold text-[#121316] group-hover:underline line-clamp-1">
                {news.title}
              </span>
              <ExternalLink className="w-3 h-3 text-[#737168] flex-shrink-0 mt-1" />
            </div>
            <span className="text-[10px] font-mono text-[#737168] block mt-0.5">{news.published_at}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
