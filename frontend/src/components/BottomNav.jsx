import React from "react";
import { Briefcase } from "lucide-react";

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F6] border-t border-[#121316] pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] px-3 sm:px-4 shadow-lg md:hidden">
      <div className="max-w-md mx-auto flex items-center justify-around gap-1.5 sm:gap-2">
        <button
          onClick={() => setActiveTab("signals")}
          className={`flex-1 py-2 px-2 sm:px-3 min-h-[42px] text-xs font-mono font-bold uppercase transition active:scale-95 text-center cursor-pointer flex items-center justify-center ${
            activeTab === "signals" ? "bg-[#121316] text-white shadow-xs" : "text-[#737168] hover:text-[#121316] hover:bg-[#E5E3DC]/40"
          }`}
        >
          Forecast
        </button>
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`flex-1 py-2 px-2 sm:px-3 min-h-[42px] text-xs font-mono font-bold uppercase transition active:scale-95 text-center cursor-pointer flex items-center justify-center ${
            activeTab === "watchlist" ? "bg-[#121316] text-white shadow-xs" : "text-[#737168] hover:text-[#121316] hover:bg-[#E5E3DC]/40"
          }`}
        >
          List Saham
        </button>
        <button
          onClick={() => setActiveTab("portfolio")}
          className={`flex-1 py-2 px-2 sm:px-3 min-h-[42px] text-xs font-mono font-bold uppercase transition active:scale-95 text-center cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === "portfolio" ? "bg-[#121316] text-white shadow-xs" : "text-[#737168] hover:text-[#121316] hover:bg-[#E5E3DC]/40"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Porto</span>
        </button>
      </div>
    </nav>
  );
}
