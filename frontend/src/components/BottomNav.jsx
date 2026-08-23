import React from "react";

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F6] border-t border-[#121316] py-2 px-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        <button
          onClick={() => setActiveTab("signals")}
          className={`px-4 py-1 text-xs font-mono font-bold uppercase transition ${
            activeTab === "signals" ? "bg-[#121316] text-white" : "text-[#737168]"
          }`}
        >
          Prakiraan Saham
        </button>
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-4 py-1 text-xs font-mono font-bold uppercase transition ${
            activeTab === "watchlist" ? "bg-[#121316] text-white" : "text-[#737168]"
          }`}
        >
          Daftar Pantau Bibit
        </button>
      </div>
    </nav>
  );
}
