import React from "react";
import { HelpCircle } from "lucide-react";

export default function KeyFactors({ factors, onOpenHowItWorks }) {
  if (!factors || factors.length === 0) return null;

  return (
    <div className="bg-white border border-[#121316] p-3.5 sm:p-5 mb-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs font-bold uppercase text-[#121316]">
          Faktor Kuantitatif & Fundamental Utama
        </span>
        {onOpenHowItWorks && (
          <button
            type="button"
            onClick={() => onOpenHowItWorks(2)}
            className="flex items-center space-x-1 text-[10px] font-mono text-[#1B5E20] hover:underline cursor-pointer p-1"
            title="Pelajari arti istilah indikator kuantitatif ini (Bab 2)"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#1B5E20]" />
            <span>Arti Istilah →</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {factors.map((f, idx) => (
          <div key={idx} className="p-3 border border-[#E5E3DC] bg-[#FAF9F6]">
            <span className="text-[10px] text-[#737168] uppercase font-mono block truncate" title={f.factor}>{f.factor}</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono-num text-sm font-bold text-[#121316]">{f.value}</span>
              <span className="text-[10px] font-serif italic text-[#595750] truncate ml-1" title={f.status}>{f.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
