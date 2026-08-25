import React from "react";
import { Star, Plus, Edit2, ShieldAlert, Sparkles } from "lucide-react";
import HoldingIcon from "./HoldingIcon";
import { formatRupiah } from "./TickerList";
import { getIdxMarketStatus } from "./Header";

export const COMPANY_NAMES = {
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
  holding = null,
  onOpenPortfolioModal,
}) {
  if (!prediction) return null;

  const isBull = prediction.signal.toLowerCase().includes("beli") || prediction.signal.toLowerCase().includes("bull");
  const isBear = prediction.signal.toLowerCase().includes("waspada") || prediction.signal.toLowerCase().includes("bear");
  const cleanTicker = prediction.ticker.replace(".JK", "");
  const companyName = COMPANY_NAMES[prediction.ticker] || `${cleanTicker} • Emiten Bursa Efek Indonesia`;
  
  const targetPrice = prediction.current_price * (1 + prediction.expected_return_pct / 100);
  const deltaPrice = targetPrice - prediction.current_price;
  const horizon = prediction.target_horizon_days || 20;

  // Personal Broker Position Calculation
  let holdingStats = null;
  if (holding && holding.buyPrice && holding.shares) {
    const totalCost = holding.buyPrice * holding.shares;
    const currentValue = prediction.current_price * holding.shares;
    const plAmount = currentValue - totalCost;
    const plPct = ((prediction.current_price - holding.buyPrice) / holding.buyPrice) * 100;
    const isProfit = plAmount >= 0;

    let brokerAdvice = "";
    if (isProfit && isBull) {
      brokerAdvice = `Posisi Anda telah mencatatkan keuntungan +${plPct.toFixed(1)}%. Model memproyeksikan potensi penguatan lanjutan menuju target ${formatRupiah(targetPrice)} (+${prediction.expected_return_pct}%). Rekomendasi Broker: Pertahankan posisi penuh (Hold & Ride Trend).`;
    } else if (isProfit && isBear) {
      brokerAdvice = `Posisi Anda untung +${plPct.toFixed(1)}%, namun model mendeteksi sinyal Waspada (Bearish) dalam 20 hari ke depan. Rekomendasi Broker: Pertimbangkan merealisasikan sebagian keuntungan (Take Profit) untuk mengunci cuan.`;
    } else if (!isProfit && isBull) {
      brokerAdvice = `Posisi Anda saat ini terkoreksi ${plPct.toFixed(1)}%. Sinyal model menunjukkan pembalikan arah positif menuju target ${formatRupiah(targetPrice)}. Rekomendasi Broker: Tahan posisi (Hold) atau pertimbangkan akumulasi bertahap jika profil risiko sesuai.`;
    } else {
      brokerAdvice = `Posisi Anda sedang turun ${plPct.toFixed(1)}% dan sinyal teknikal masih dalam tekanan jual. Rekomendasi Broker: Pasang Stop Loss disiplin di bawah area support terdekat untuk mencegah kerugian lebih dalam.`;
    }

    holdingStats = {
      totalCost,
      currentValue,
      plAmount,
      plPct,
      isProfit,
      brokerAdvice,
    };
  }

  return (
    <div className="bg-white border border-[#121316] p-4 mb-3">
      {/* 1. Header Saham & Indikator Portofolio / Favorit */}
      <div className="border-b border-[#E5E3DC] pb-3 mb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-editorial font-bold text-3xl text-[#121316] tracking-tight">{cleanTicker}</h2>
              
              {/* Bought / Portfolio Priority Icon */}
              {holding ? (
                <button
                  type="button"
                  onClick={onOpenPortfolioModal}
                  className="px-2 py-0.5 hover:bg-[#E8F5E9] rounded transition active:scale-95 flex items-center space-x-1.5 border border-[#1B5E20]/40 bg-[#E8F5E9]/60"
                  title="Saham Dimiliki di Portofolio (Klik untuk edit)"
                >
                  <HoldingIcon className="w-3.5 h-3.5" color="#1B5E20" />
                  <span className="text-[10px] font-mono font-bold text-[#1B5E20] uppercase">
                    Dimiliki
                  </span>
                </button>
              ) : null}

              {/* Favorite Star Toggle Button */}
              <button
                type="button"
                onClick={() => onToggleFavorite && onToggleFavorite(prediction.ticker)}
                className="p-1 hover:bg-[#F1EFEA] rounded transition active:scale-95"
                title={isFavorite ? "Hapus dari Favorit" : "Sematkan ke Favorit"}
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
            <span className="text-[10px] uppercase tracking-wider text-[#737168] block">
              {getIdxMarketStatus().isOpen ? "Harga Pasar Live" : "Harga Penutupan (Pasar Tutup)"}
            </span>
            <span className="font-mono-num text-2xl font-bold text-[#121316]">
              {formatRupiah(prediction.current_price)}
            </span>
          </div>
        </div>
      </div>

      {/* High-Precision ML Action Alert Banner (Urgent Sell / Prime Buy) */}
      {prediction.action_alert && prediction.action_alert.type === "URGENT_SELL" && (
        <div className="mb-3 p-3 bg-[#FFEBEE] border border-[#B71C1C] flex items-start space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-[#B71C1C] shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[10px] font-bold uppercase text-[#B71C1C]">
                Peringatan Jual Darurat (Presisi ML {prediction.action_alert.precision_score}%)
              </span>
            </div>
            <p className="text-xs text-[#B71C1C] mt-0.5 leading-snug">
              {prediction.action_alert.message}
            </p>
          </div>
        </div>
      )}

      {prediction.action_alert && prediction.action_alert.type === "PRIME_BUY" && (
        <div className="mb-3 p-3 bg-[#E8F5E9] border border-[#1B5E20] flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-[#1B5E20] shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[10px] font-bold uppercase text-[#1B5E20]">
                Prospek Bagus (Presisi ML {prediction.action_alert.precision_score}%)
              </span>
            </div>
            <p className="text-xs text-[#1B5E20] mt-0.5 leading-snug">
              {prediction.action_alert.message}
            </p>
          </div>
        </div>
      )}

      {/* 2. Personal Broker Position Panel (If User Bought This Stock) */}
      {holdingStats ? (
        <div className="mb-3 p-3 bg-[#FAF9F6] border border-[#121316]">
          <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2 mb-2.5">
            <div className="flex items-center space-x-1.5">
              <HoldingIcon className="w-4 h-4" color="#1B5E20" />
              <span className="font-mono text-xs font-bold uppercase text-[#121316]">
                Posisi Portofolio Anda
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenPortfolioModal}
              className="text-[10px] font-mono font-bold text-[#121316] underline hover:text-[#737168] flex items-center space-x-1"
            >
              <Edit2 className="w-3 h-3 mr-0.5" />
              <span>Ubah Posisi</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left mb-2.5">
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Harga Beli Rata-rata</span>
              <span className="font-mono-num text-xs font-bold text-[#121316]">
                {formatRupiah(holding.buyPrice)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Kepemilikan</span>
              <span className="font-mono-num text-xs font-bold text-[#121316]">
                {holding.lots} Lot ({holding.shares.toLocaleString("id-ID")} lbr)
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Total Modal</span>
              <span className="font-mono-num text-xs font-bold text-[#121316]">
                {formatRupiah(holdingStats.totalCost)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Untung / Rugi (P/L)</span>
              <span
                className={`font-mono-num text-xs font-bold ${
                  holdingStats.isProfit ? "text-[#1B5E20]" : "text-[#B71C1C]"
                }`}
              >
                {holdingStats.isProfit ? "+" : ""}
                {formatRupiah(holdingStats.plAmount)} ({holdingStats.isProfit ? "+" : ""}{holdingStats.plPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Broker Tactical Guidance Box */}
          <div className="p-2.5 bg-white border border-[#DCDAD4] text-xs font-sans">
            <p className="text-[11px] text-[#2B2925] leading-relaxed">
              {holdingStats.brokerAdvice}
            </p>
          </div>
        </div>
      ) : (
        /* Action to Add to Portfolio if Not Owned */
        <div className="mb-3 p-2.5 bg-[#FAF9F6] border border-dashed border-[#A8A59C] flex items-center justify-between">
          <div>
            <span className="font-mono text-[11px] font-bold text-[#121316] block">
              Punya Saham {cleanTicker}?
            </span>
            <span className="text-[10px] text-[#737168] font-sans block">
              Catat pembelian Anda agar broker AI dapat menghitung P/L dan memberikan saran personal.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenPortfolioModal}
            className="px-2.5 py-1.5 bg-[#121316] text-white hover:bg-black font-mono font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1 transition active:scale-95 shrink-0"
          >
            <Plus className="w-3 h-3 mr-1" />
            <span>Catat Saham</span>
          </button>
        </div>
      )}

      {/* 3. Banner Sinyal & Target */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left mb-3">
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

      {/* 4. Dynamic ATR Risk Management & Adaptive Exit Brackets (Upgrade #5) */}
      {prediction.risk_management && (
        <div className="mb-3 p-3 bg-white border border-[#121316] shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2 mb-2.5">
            <span className="font-mono text-xs font-bold uppercase text-[#121316] flex items-center">
              <span className="w-2 h-2 rounded-full bg-[#121316] mr-1.5 inline-block"></span>
              Manajemen Risiko & Batas Keluar (ATR 14)
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 border text-[#121316] bg-[#F1EFEA]">
              Risk:Reward {prediction.risk_management.risk_reward_ratio}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
            <div>
              <span className="text-[9px] uppercase font-mono text-[#B71C1C] block">Batas Stop Loss</span>
              <span className="font-mono-num text-xs font-bold text-[#B71C1C]">
                {formatRupiah(prediction.risk_management.stop_loss_price)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#1B5E20] block">Target Optimal (TP)</span>
              <span className="font-mono-num text-xs font-bold text-[#1B5E20]">
                {formatRupiah(prediction.risk_management.take_profit_price)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Target Konservatif</span>
              <span className="font-mono-num text-xs font-bold text-[#121316]">
                {formatRupiah(prediction.risk_management.conservative_target_price)}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Tingkat Risiko</span>
              <span
                className="font-mono text-xs font-bold block"
                style={{ color: prediction.risk_management.risk_color || "#121316" }}
              >
                {prediction.risk_management.risk_level.split(" ")[0]} ({prediction.risk_management.risk_pct}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Fundamental Valuation Multiples & Health Snapshot (Upgrade #1 & #2) */}
      {prediction.fundamentals && (
        <div className="p-3 bg-[#FAF9F6] border border-[#121316]">
          <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2 mb-2">
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-xs font-bold uppercase text-[#121316]">
                Kesehatan Fundamental & Arus Institusi
              </span>
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.2 border uppercase"
                style={{
                  color: prediction.fundamentals.status_color || "#121316",
                  borderColor: `${prediction.fundamentals.status_color || "#121316"}40`,
                  backgroundColor: "#FFFFFF"
                }}
              >
                {prediction.fundamentals.grade}
              </span>
            </div>
            {prediction.institutional_flow && (
              <span className="text-[10px] font-mono font-bold text-[#1B5E20] hidden sm:inline-block">
                {prediction.institutional_flow.flow_status}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-left text-xs mb-1.5">
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">P/E Ratio</span>
              <span className="font-mono-num font-bold text-[#121316]">
                {prediction.fundamentals.pe_ratio > 0 ? `${prediction.fundamentals.pe_ratio}x` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">PBV Ratio</span>
              <span className="font-mono-num font-bold text-[#121316]">
                {prediction.fundamentals.pbv_ratio}x
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">ROE (%)</span>
              <span className={`font-mono-num font-bold ${prediction.fundamentals.roe_pct >= 15 ? "text-[#1B5E20]" : "text-[#121316]"}`}>
                {prediction.fundamentals.roe_pct}%
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">DER (Utang)</span>
              <span className={`font-mono-num font-bold ${prediction.fundamentals.der_ratio > 2.0 ? "text-[#B71C1C]" : "text-[#121316]"}`}>
                {prediction.fundamentals.der_ratio}x
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-[#737168] block">Dividen Yield</span>
              <span className="font-mono-num font-bold text-[#1B5E20]">
                {prediction.fundamentals.dividend_yield_pct > 0 ? `${prediction.fundamentals.dividend_yield_pct}%` : "-"}
              </span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#595750] mt-1 pt-1 border-t border-[#E5E3DC]/60 flex items-center justify-between">
            <span>💡 {prediction.fundamentals.highlight_reason}</span>
            {prediction.macro_context && (
              <span className="text-[#737168]">
                Beta IHSG: {prediction.macro_context.beta_ihsg_30} • IHSG: {prediction.macro_context.ihsg_status}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
