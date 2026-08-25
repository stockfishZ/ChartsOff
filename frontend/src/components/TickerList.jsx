import React from "react";
import { Star, Sparkles } from "lucide-react";
import HoldingIcon from "./HoldingIcon";

export function formatRupiah(val) {
  if (val == null || isNaN(val)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function TickerList({
  predictions,
  selectedTicker,
  onSelectTicker,
  favorites = [],
  portfolio = {},
}) {
  return (
    <div className="border-b border-[#DCDAD4] bg-[#F1EFEA]">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center space-x-2 overflow-x-auto px-3.5 py-2.5 no-scrollbar">
          {predictions.map((item) => {
            const isSelected = selectedTicker === item.ticker;
            const isBought = Boolean(portfolio[item.ticker]);
            const isFavorite = favorites.includes(item.ticker);
            const isPrimeBuy = item.action_alert?.type === "PRIME_BUY";
            const isBull = item.signal.toLowerCase().includes("beli") || item.signal.toLowerCase().includes("bull");
            const isBear = item.signal.toLowerCase().includes("waspada") || item.signal.toLowerCase().includes("bear");
            const cleanCode = item.ticker.replace(".JK", "");

            return (
              <button
                key={item.ticker}
                onClick={() => onSelectTicker(item.ticker)}
                className={`flex-shrink-0 px-3.5 py-2 min-h-[46px] border transition-all text-left active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? "bg-white border-[#121316] shadow-sm ring-1 ring-[#121316]"
                    : isPrimeBuy
                    ? "bg-white border-[#1B5E20]/60 hover:bg-white text-[#121316]"
                    : isBought
                    ? "bg-white/80 border-[#1B5E20]/40 hover:bg-white text-[#595750]"
                    : "bg-transparent border-transparent hover:bg-white/60 text-[#595750]"
                }`}
              >
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex items-center">
                    {isBought ? (
                      <HoldingIcon
                        className="w-3.5 h-3.5 mr-1 flex-shrink-0"
                        color="#1B5E20"
                      />
                    ) : isFavorite ? (
                      <Star
                        className="w-3 h-3 text-[#D97706] fill-[#D97706] flex-shrink-0 mr-1"
                        title="Favorit / Disematkan"
                      />
                    ) : null}
                    <span className={`font-editorial font-bold text-sm tracking-wide ${isSelected ? "text-[#121316]" : "text-[#2B2925]"}`}>
                      {cleanCode}
                    </span>
                  </div>
                  {isPrimeBuy ? (
                    <span
                      className="text-[8.5px] uppercase font-mono font-bold tracking-wider px-1 py-0.2 border text-[#1B5E20] border-[#1B5E20] bg-[#E8F5E9] flex items-center"
                      title="Prospek Bagus: Konfluensi momentum dan sentimen positif terkonfirmasi"
                    >
                      <Sparkles className="w-2.5 h-2.5 mr-0.5 text-[#1B5E20]" />
                      Prospek Bagus
                    </span>
                  ) : (
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 border ${
                        isBull
                          ? "text-[#1B5E20] border-[#1B5E20]/30 bg-[#E8F5E9]"
                          : isBear
                          ? "text-[#B71C1C] border-[#B71C1C]/30 bg-[#FFEBEE]"
                          : "text-[#5D4037] border-[#5D4037]/30 bg-[#EFEBE9]"
                      }`}
                    >
                      {item.signal.split(" ")[0]}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between space-x-2 mt-0.5">
                  <span className="font-mono-num text-[11px] font-semibold text-[#121316]">
                    {formatRupiah(item.current_price)}
                  </span>
                  <span
                    className={`font-mono-num text-[10px] font-medium ${
                      item.expected_return_pct >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
                    }`}
                  >
                    {item.expected_return_pct >= 0 ? "+" : ""}
                    {item.expected_return_pct}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
