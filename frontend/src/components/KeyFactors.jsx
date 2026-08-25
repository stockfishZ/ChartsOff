import React from "react";
import { HelpCircle } from "lucide-react";

export default function KeyFactors({ factors, onOpenHowItWorks }) {
  if (!factors || factors.length === 0) return null;

  return (
    <div className="bg-white border border-[#121316] p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase text-[#121316]">
          Indikator Teknikal Kuantitatif
        </span>
        {onOpenHowItWorks && (
          <button
            type="button"
            onClick={() => onOpenHowItWorks(2)}
            className="flex items-center space-x-1 text-[10px] font-mono text-[#1B5E20] hover:underline cursor-pointer"
            title="Pelajari arti istilah indikator kuantitatif ini (Bab 2)"
          >
            <HelpCircle className="w-3 h-3 text-[#1B5E20]" />
            <span>Arti Istilah →</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {factors.map((f, idx) => (
          <div key={idx} className="p-2 border border-[#E5E3DC] bg-[#FAF9F6]">
            <span className="text-[10px] text-[#737168] uppercase block truncate">{f.factor}</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="font-mono-num text-sm font-bold text-[#121316]">{f.value}</span>
              <span className="text-[10px] font-serif italic text-[#595750] truncate ml-1">{f.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
