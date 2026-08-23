import React from "react";
import { Star } from "lucide-react";
import { formatRupiah } from "./TickerList";

const COMPANY_NAMES = {
  "BBCA.JK": "Bank Central Asia Tbk",
  "BBRI.JK": "Bank Rakyat Indonesia (Persero) Tbk",
  "BMRI.JK": "Bank Mandiri (Persero) Tbk",
  "BBNI.JK": "Bank Negara Indonesia (Persero) Tbk",
  "BRIS.JK": "Bank Syariah Indonesia Tbk",
  "BBTN.JK": "Bank Tabungan Negara (Persero) Tbk",
  "ARTO.JK": "Bank Jago Tbk",
  "BDMN.JK": "Bank Danamon Indonesia Tbk",
  "TLKM.JK": "Telkom Indonesia (Persero) Tbk",
  "ISAT.JK": "Indosat Ooredoo Hutchison Tbk",
  "EXCL.JK": "XL Axiata Tbk",
  "GOTO.JK": "GoTo Gojek Tokopedia Tbk",
  "BUKA.JK": "Bukalapak.com Tbk",
  "EMTK.JK": "Elang Mahkota Teknologi Tbk",
  "ADRO.JK": "Adaro Energy Indonesia Tbk",
  "PTBA.JK": "Bukit Asam Tbk",
  "ITMG.JK": "Indo Tambangraya Megah Tbk",
  "ANTM.JK": "Aneka Tambang (Antam) Tbk",
  "INCO.JK": "Vale Indonesia Tbk",
  "MDKA.JK": "Merdeka Copper Gold Tbk",
  "AMMN.JK": "Amman Mineral Internasional Tbk",
  "MEDC.JK": "Medco Energi Internasional Tbk",
  "PGAS.JK": "Perusahaan Gas Negara (PGN) Tbk",
  "AKRA.JK": "AKR Corporindo Tbk",
  "BUMI.JK": "Bumi Resources Tbk",
  "BRPT.JK": "Barito Pacific Tbk",
  "TPIA.JK": "Chandra Asri Petrochemical Tbk",
  "ICBP.JK": "Indofood CBP Sukses Makmur Tbk",
  "INDF.JK": "Indofood Sukses Makmur Tbk",
  "UNVR.JK": "Unilever Indonesia Tbk",
  "MYOR.JK": "Mayora Indah Tbk",
  "KLBF.JK": "Kalbe Farma Tbk",
  "SIDO.JK": "Industri Jamu Dan Farmasi Sido Muncul Tbk",
  "AMRT.JK": "Sumber Alfaria Trijaya (Alfamart) Tbk",
  "MAPI.JK": "Mitra Adiperkasa Tbk",
  "ACES.JK": "Aspirasi Hidup Indonesia (Ace Hardware) Tbk",
  "CPIN.JK": "Charoen Pokphand Indonesia Tbk",
  "JPFA.JK": "Japfa Comfeed Indonesia Tbk",
  "GGRM.JK": "Gudang Garam Tbk",
  "HMSP.JK": "H.M. Sampoerna Tbk",
  "ASII.JK": "Astra International Tbk",
  "UNTR.JK": "United Tractors Tbk",
  "AUTO.JK": "Astra Otoparts Tbk",
  "SMGR.JK": "Semen Indonesia (Persero) Tbk",
  "INTP.JK": "Indocement Tunggal Prakarsa Tbk",
  "CTRA.JK": "Ciputra Development Tbk",
  "BSDE.JK": "Bumi Serpong Damai Tbk",
  "PWON.JK": "Pakuwon Jati Tbk",
  "SMRA.JK": "Summarecon Agung Tbk",
  "JSMR.JK": "Jasa Marga (Persero) Tbk"
};

export default function PredictionCard({
  prediction,
  isFavorite = false,
  onToggleFavorite,
}) {
  if (!prediction) return null;

  const isBull = prediction.signal.toLowerCase().includes("beli") || prediction.signal.toLowerCase().includes("bull");
  const isBear = prediction.signal.toLowerCase().includes("waspada") || prediction.signal.toLowerCase().includes("bear");
  const cleanTicker = prediction.ticker.replace(".JK", "");
  const companyName = COMPANY_NAMES[prediction.ticker] || `${cleanTicker} • Emiten Bursa Efek Indonesia`;
  
  const targetPrice = prediction.current_price * (1 + prediction.expected_return_pct / 100);
  const deltaPrice = targetPrice - prediction.current_price;
  const horizon = prediction.target_horizon_days || 20;

  return (
    <div className="bg-white border border-[#121316] p-4 mb-3">
      {/* 1. Header Saham & Tombol Favorit / Pin */}
      <div className="border-b border-[#E5E3DC] pb-3 mb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-editorial font-bold text-3xl text-[#121316] tracking-tight">{cleanTicker}</h2>
              <button
                type="button"
                onClick={() => onToggleFavorite && onToggleFavorite(prediction.ticker)}
                className="p-1 hover:bg-[#F1EFEA] rounded transition active:scale-95"
                title={isFavorite ? "Hapus dari Favorit / Pin" : "Sematkan ke Favorit / Pin"}
              >
                <Star
                  className={`w-5 h-5 transition-colors ${
                    isFavorite
                      ? "text-[#D97706] fill-[#D97706]"
                      : "text-[#A8A59C] hover:text-[#121316]"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[#737168] font-sans mt-0.5">{companyName}</p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-[#737168] block">Harga Saham</span>
            <span className="font-mono-num text-2xl font-bold text-[#121316]">
              {formatRupiah(prediction.current_price)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Banner Sinyal & Kondisi Pasar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
        {/* Sinyal ML */}
        <div
          className={`p-2.5 border ${
            isBull
              ? "border-[#1B5E20] bg-[#E8F5E9]"
              : isBear
              ? "border-[#B71C1C] bg-[#FFEBEE]"
              : "border-[#121316] bg-[#F1EFEA]"
          }`}
        >
          <span className="text-[9px] uppercase font-bold tracking-wider text-[#595750] block">Sinyal Rekomendasi</span>
          <div
            className={`font-mono font-bold text-sm mt-0.5 ${
              isBull ? "text-[#1B5E20]" : isBear ? "text-[#B71C1C]" : "text-[#121316]"
            }`}
          >
            {prediction.signal.toUpperCase()}
          </div>
          <span className="text-[10px] font-mono text-[#595750] block mt-0.5">
            Keyakinan: {prediction.confidence}%
          </span>
        </div>

        {/* Target 20 Hari */}
        <div className="p-2.5 border border-[#121316] bg-[#FAF9F6]">
          <span className="text-[9px] uppercase font-bold tracking-wider text-[#737168] block">Target {horizon} Hari (1 Bln)</span>
          <div className="font-mono-num font-bold text-sm text-[#121316] mt-0.5">
            {formatRupiah(targetPrice)}
          </div>
          <span
            className={`text-[10px] font-mono-num font-semibold block mt-0.5 ${
              prediction.expected_return_pct >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
            }`}
          >
            {prediction.expected_return_pct >= 0 ? "+" : ""}{prediction.expected_return_pct}% ({deltaPrice >= 0 ? `+${formatRupiah(deltaPrice)}` : `-${formatRupiah(Math.abs(deltaPrice))}`})
          </span>
        </div>

        {/* Kondisi / Regime Pasar */}
        <div className="p-2.5 border border-[#121316] bg-[#FAF9F6]">
          <span className="text-[9px] uppercase font-bold tracking-wider text-[#737168] block">Kondisi Pasar</span>
          <div className="font-serif font-bold text-sm text-[#121316] mt-0.5 truncate">
            {prediction.market_regime}
          </div>
          <span className="text-[10px] font-mono text-[#737168] block mt-0.5 truncate">
            Sentimen: {prediction.news_sentiment?.sentiment_label || "Netral"}
          </span>
        </div>
      </div>
    </div>
  );
}
