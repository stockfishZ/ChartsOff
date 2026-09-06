import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Layers, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { IDX_COMPANIES } from "../data/idx_companies";

export const TICKER_SECTORS = {
  // Perbankan & Keuangan
  "BBCA.JK": "Perbankan", "BBRI.JK": "Perbankan", "BMRI.JK": "Perbankan", "BBNI.JK": "Perbankan",
  "BRIS.JK": "Perbankan", "BBTN.JK": "Perbankan", "ARTO.JK": "Perbankan", "BDMN.JK": "Perbankan", "BTPS.JK": "Perbankan",
  // Telekomunikasi
  "TLKM.JK": "Telekomunikasi", "ISAT.JK": "Telekomunikasi", "EXCL.JK": "Telekomunikasi",
  // Teknologi
  "GOTO.JK": "Teknologi", "BUKA.JK": "Teknologi", "EMTK.JK": "Teknologi", "MTDL.JK": "Teknologi",
  // Energi
  "ADRO.JK": "Energi", "PTBA.JK": "Energi", "ITMG.JK": "Energi", "MEDC.JK": "Energi", "PGAS.JK": "Energi", "AKRA.JK": "Energi", "BUMI.JK": "Energi",
  // Tambang & Mineral
  "ANTM.JK": "Tambang", "INCO.JK": "Tambang", "MDKA.JK": "Tambang", "AMMN.JK": "Tambang", "BRPT.JK": "Tambang", "TPIA.JK": "Tambang", "CUAN.JK": "Tambang",
  // Konsumsi
  "ICBP.JK": "Konsumsi", "INDF.JK": "Konsumsi", "UNVR.JK": "Konsumsi", "MYOR.JK": "Konsumsi", "CPIN.JK": "Konsumsi", "JPFA.JK": "Konsumsi", "GGRM.JK": "Konsumsi", "HMSP.JK": "Konsumsi", "CMRY.JK": "Konsumsi", "ULTJ.JK": "Konsumsi",
  // Kesehatan
  "KLBF.JK": "Kesehatan", "SIDO.JK": "Kesehatan", "MIKA.JK": "Kesehatan", "HEAL.JK": "Kesehatan", "SILO.JK": "Kesehatan",
  // Ritel
  "AMRT.JK": "Ritel", "MIDI.JK": "Ritel", "MAPI.JK": "Ritel", "ACES.JK": "Ritel",
  // Otomotif & Alat Berat
  "ASII.JK": "Otomotif", "UNTR.JK": "Otomotif", "AUTO.JK": "Otomotif",
  // Industri Dasar
  "SMGR.JK": "Industri", "INTP.JK": "Industri",
  // Properti
  "CTRA.JK": "Properti", "BSDE.JK": "Properti", "PWON.JK": "Properti", "SMRA.JK": "Properti",
  // Infrastruktur
  "JSMR.JK": "Infrastruktur",
};

export function getSectorForTicker(ticker) {
  if (TICKER_SECTORS[ticker]) return TICKER_SECTORS[ticker];
  const clean = ticker.replace(".JK", "").toUpperCase();
  const match = IDX_COMPANIES.find((c) => c.ticker.toUpperCase() === clean);
  if (match?.sector) return match.sector;
  return "Lainnya";
}

export default function SectorHeatmap({ predictions = [], onSelectStock }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedSector, setSelectedSector] = useState(null);

  // Group predictions by sector and calculate aggregated metrics
  const sectorData = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    const map = {};

    predictions.forEach((p) => {
      const sector = getSectorForTicker(p.ticker);
      if (!map[sector]) {
        map[sector] = {
          name: sector,
          stocks: [],
          totalReturn: 0,
          totalSentiment: 0,
          sentimentCount: 0,
          bullishCount: 0,
          bearishCount: 0,
        };
      }

      map[sector].stocks.push(p);
      map[sector].totalReturn += p.expected_return_pct || 0;

      if (p.news_sentiment && typeof p.news_sentiment.avg_sentiment === "number") {
        map[sector].totalSentiment += p.news_sentiment.avg_sentiment;
        map[sector].sentimentCount += 1;
      }

      const sig = (p.signal || "").toLowerCase();
      if (sig.includes("beli") || sig.includes("bull")) {
        map[sector].bullishCount += 1;
      } else if (sig.includes("waspada") || sig.includes("bear")) {
        map[sector].bearishCount += 1;
      }
    });

    return Object.values(map)
      .map((sec) => {
        const count = sec.stocks.length;
        const avgReturn = count > 0 ? sec.totalReturn / count : 0;
        const avgSentiment = sec.sentimentCount > 0 ? sec.totalSentiment / sec.sentimentCount : 0;

        // Sort stocks inside sector by expected_return_pct descending
        sec.stocks.sort((a, b) => (b.expected_return_pct || 0) - (a.expected_return_pct || 0));

        return {
          ...sec,
          count,
          avgReturn: parseFloat(avgReturn.toFixed(2)),
          avgSentiment: parseFloat(avgSentiment.toFixed(2)),
          topStock: sec.stocks[0],
        };
      })
      .sort((a, b) => b.avgReturn - a.avgReturn);
  }, [predictions]);

  if (!predictions || predictions.length === 0) return null;

  return (
    <div className="bg-white border border-[#121316] shadow-xs mb-3.5 sm:mb-4">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 py-2.5 sm:px-4 flex items-center justify-between border-b border-[#E5E3DC] cursor-pointer bg-[#FAF9F6] hover:bg-[#F1EFEA] transition select-none"
      >
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#121316]" />
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#121316] tracking-tight">
              Peta Sektor BEI (Heatmap)
            </span>
            <span className="text-[10px] text-[#737168] font-mono ml-2">
              {sectorData.length} Sektor Terpantau
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {sectorData.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 border border-[#121316]/20 bg-white text-[#121316]">
              Top: {sectorData[0].name} ({sectorData[0].avgReturn >= 0 ? "+" : ""}{sectorData[0].avgReturn}%)
            </span>
          )}
          <button
            type="button"
            className="p-0.5 text-[#737168] hover:text-[#121316]"
            title={isExpanded ? "Ciutkan Heatmap" : "Bentangkan Heatmap"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Heatmap Content Body */}
      {isExpanded && (
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {sectorData.map((sec) => {
              const isSelected = selectedSector === sec.name;
              const isStrongBull = sec.avgReturn >= 2.0;
              const isModBull = sec.avgReturn > 0 && sec.avgReturn < 2.0;
              const isNeutral = sec.avgReturn === 0;
              const isModBear = sec.avgReturn < 0 && sec.avgReturn > -2.0;
              const isStrongBear = sec.avgReturn <= -2.0;

              // Color styles matching project design guidelines
              let cardBg = "bg-[#FAF9F6] border-[#DCDAD4]";
              let textColor = "text-[#595750]";
              let badgeBg = "bg-[#E5E3DC] text-[#595750]";

              if (isStrongBull) {
                cardBg = "bg-[#E8F5E9] border-[#1B5E20]/50 hover:border-[#1B5E20]";
                textColor = "text-[#1B5E20]";
                badgeBg = "bg-[#C8E6C9] text-[#1B5E20]";
              } else if (isModBull) {
                cardBg = "bg-[#F1F8E9] border-[#33691E]/30 hover:border-[#33691E]";
                textColor = "text-[#33691E]";
                badgeBg = "bg-[#DCEDC8] text-[#33691E]";
              } else if (isStrongBear) {
                cardBg = "bg-[#FFEBEE] border-[#B71C1C]/50 hover:border-[#B71C1C]";
                textColor = "text-[#B71C1C]";
                badgeBg = "bg-[#FFCDD2] text-[#B71C1C]";
              } else if (isModBear) {
                cardBg = "bg-[#FFF3E0] border-[#E65100]/30 hover:border-[#E65100]";
                textColor = "text-[#BF360C]";
                badgeBg = "bg-[#FFE0B2] text-[#BF360C]";
              }

              return (
                <div
                  key={sec.name}
                  onClick={() => setSelectedSector(isSelected ? null : sec.name)}
                  className={`p-2.5 border transition cursor-pointer flex flex-col justify-between rounded-xs ${cardBg} ${
                    isSelected ? "ring-2 ring-[#121316] shadow-sm" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-editorial font-bold text-xs text-[#121316] truncate">
                        {sec.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#737168] shrink-0">
                        {sec.count} emiten
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-mono-num font-bold text-sm sm:text-base ${textColor}`}>
                        {sec.avgReturn >= 0 ? "+" : ""}{sec.avgReturn}%
                      </span>
                      {sec.avgReturn >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-[#1B5E20]" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-[#B71C1C]" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-black/5 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#737168] truncate">
                      Sentimen: {sec.avgSentiment > 0 ? "Positif" : sec.avgSentiment < 0 ? "Waspada" : "Netral"}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-xs font-bold ${badgeBg}`}>
                      {sec.bullishCount} B / {sec.bearishCount} S
                    </span>
                  </div>

                  {/* Quick Ticker Pills */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sec.stocks.slice(0, 3).map((st) => {
                      const clean = st.ticker.replace(".JK", "");
                      return (
                        <button
                          key={st.ticker}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectStock) onSelectStock(st.ticker);
                          }}
                          className="text-[10px] font-mono font-bold px-2 py-1 min-h-[28px] inline-flex items-center justify-center bg-white/80 border border-black/15 hover:bg-[#121316] hover:text-white transition cursor-pointer"
                          title={`Buka ${clean}: Target ${st.expected_return_pct}%`}
                        >
                          {clean}
                        </button>
                      );
                    })}
                    {sec.stocks.length > 3 && (
                      <span className="text-[10px] font-mono text-[#737168] self-center">
                        +{sec.stocks.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded Detail Panel when a sector is selected */}
          {selectedSector && (
            <div className="mt-3 p-3 bg-[#FAF9F6] border border-[#121316] text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E3DC] mb-2">
                <span className="font-mono font-bold text-xs uppercase text-[#121316]">
                  Daftar Saham Sektor: {selectedSector}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSector(null)}
                  className="font-mono text-[10px] text-[#737168] hover:text-[#121316] underline"
                >
                  Tutup Detail
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sectorData
                  .find((s) => s.name === selectedSector)
                  ?.stocks.map((st) => {
                    const clean = st.ticker.replace(".JK", "");
                    const isBull = (st.signal || "").toLowerCase().includes("beli") || (st.signal || "").toLowerCase().includes("bull");
                    return (
                      <div
                        key={st.ticker}
                        onClick={() => {
                          if (onSelectStock) onSelectStock(st.ticker);
                        }}
                        className="p-2 bg-white border border-[#E5E3DC] hover:border-[#121316] transition cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-editorial font-bold text-sm text-[#121316]">{clean}</span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase border ${
                              isBull
                                ? "text-[#1B5E20] border-[#1B5E20]/30 bg-[#E8F5E9]"
                                : "text-[#B71C1C] border-[#B71C1C]/30 bg-[#FFEBEE]"
                            }`}
                          >
                            {st.signal?.split(" ")[0]}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono-num font-bold text-xs text-[#121316]">
                            Rp {st.current_price?.toLocaleString("id-ID")}
                          </div>
                          <span
                            className={`font-mono-num text-[10px] font-bold ${
                              st.expected_return_pct >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
                            }`}
                          >
                            {st.expected_return_pct >= 0 ? "+" : ""}{st.expected_return_pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
