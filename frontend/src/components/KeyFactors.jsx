import React from "react";

export default function KeyFactors({ factors }) {
  if (!factors || factors.length === 0) return null;

  return (
    <div className="bg-white border border-[#121316] p-4 mb-3">
      <span className="font-mono text-xs font-bold uppercase text-[#121316] block mb-2">Indikator Teknikal Kuantitatif</span>
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
