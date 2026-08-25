import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";

export default function HowItWorksModal({ isOpen, onClose, initialChapter }) {
  const chapter2Ref = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (initialChapter === 2 || initialChapter === "indicators") {
        const timer = setTimeout(() => {
          if (chapter2Ref.current) {
            chapter2Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 120);
        return () => clearTimeout(timer);
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, initialChapter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] border-2 border-[#121316] w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl relative overflow-hidden text-[#121316]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Editorial Header */}
        <div className="bg-white border-b border-[#121316] p-4 sm:px-6 flex items-center justify-between shrink-0">
          <h2 className="font-editorial font-bold text-xl sm:text-2xl text-[#121316] leading-tight">
            Metodologi Model & Indikator Teknikal
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border border-[#121316] bg-[#FAF9F6] hover:bg-[#121316] hover:text-white transition active:scale-95 text-[#121316] cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Continuous Scrollable Article Body */}
        <div
          ref={scrollContainerRef}
          className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-[#121316] leading-relaxed"
        >
          {/* SECTION 1: SYSTEM PIPELINE */}
          <section className="bg-white border border-[#121316] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2 mb-3">
              <h3 className="font-editorial font-bold text-base text-[#121316]">
                1. Alur Pemrosesan Data & Machine Learning
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 border border-[#E5E3DC] bg-[#FAF9F6]">
                <span className="font-mono text-[10px] font-bold text-[#737168] block mb-1">01. INGESTION</span>
                <p className="font-bold text-[#121316] mb-1">Pasar & Berita</p>
                <p className="text-[#595750] text-[11px] leading-snug">
                  Menarik 365 data perdagangan harian (OHLCV) dari Bursa Efek Indonesia dan artikel media finansial (*CNBC, Detik, Antara*).
                </p>
              </div>

              <div className="p-3 border border-[#E5E3DC] bg-[#FAF9F6]">
                <span className="font-mono text-[10px] font-bold text-[#737168] block mb-1">02. FEATURE ENG.</span>
                <p className="font-bold text-[#121316] mb-1">27 Indikator Kuantitatif</p>
                <p className="text-[#595750] text-[11px] leading-snug">
                  Menghitung parameter momentum (RSI, MACD), deviasi volatilitas (Bollinger %B, ATR), rasio volume, dan skor leksikal berita.
                </p>
              </div>

              <div className="p-3 border border-[#E5E3DC] bg-[#FAF9F6]">
                <span className="font-mono text-[10px] font-bold text-[#737168] block mb-1">03. ML INFERENCE</span>
                <p className="font-bold text-[#121316] mb-1">Gradient Boosting</p>
                <p className="text-[#595750] text-[11px] leading-snug">
                  Model <em>ensemble tree</em> mengklasifikasikan probabilitas arah harga 5–20 hari ke depan dan menghitung proyeksi kenaikan/penurunan.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2: TECHNICAL INDICATORS BREAKDOWN */}
          <section ref={chapter2Ref} className="bg-white border border-[#121316] p-4 sm:p-5 shadow-xs scroll-mt-2">
            <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2 mb-3">
              <h3 className="font-editorial font-bold text-base text-[#121316]">
                2. Parameter Indikator Teknikal Kuantitatif
              </h3>
              <span className="font-mono text-[10px] text-[#737168] uppercase">Kamus & Rentang Nilai</span>
            </div>

            <div className="divide-y divide-[#E5E3DC]">
              {/* RSI */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-[#121316]">RSI 14 (Relative Strength Index)</span>
                  <span className="font-mono text-[10px] text-[#737168]">Rentang: 0 – 100</span>
                </div>
                <p className="text-[11px] text-[#595750] mb-1.5">
                  Mengukur rasio rata-rata kenaikan terhadap penurunan harga selama 14 hari perdagangan terakhir.
                </p>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#B71C1C] font-bold">&gt; 70 (Overbought)</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Kenaikan cepat, rawan aksi profit-taking.</p>
                  </div>
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#121316] font-bold">40 – 60 (Netral)</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Momentum seimbang tanpa tekanan ekstrem.</p>
                  </div>
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#1B5E20] font-bold">&lt; 30 (Oversold)</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Penjualan jenuh, area potensi <em>mean-reversion</em>.</p>
                  </div>
                </div>
              </div>

              {/* MACD Histogram */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-[#121316]">MACD Histogram</span>
                  <span className="font-mono text-[10px] text-[#737168]">(EMA12 - EMA26) - Signal9</span>
                </div>
                <p className="text-[11px] text-[#595750] mb-1.5">
                  Mengukur akselerasi momentum jangka pendek relatif terhadap tren jangka menengah.
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#1B5E20] font-bold">Nilai Positif (+)</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Akselerasi harga menguat ke atas, pembeli memegang kendali.</p>
                  </div>
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#B71C1C] font-bold">Nilai Negatif (-)</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Momentum melemah atau tekanan jual meningkat.</p>
                  </div>
                </div>
              </div>

              {/* Bollinger Bands %B */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-[#121316]">Bollinger Bands %B</span>
                  <span className="font-mono text-[10px] text-[#737168]">Deviasi 2σ dari SMA20</span>
                </div>
                <p className="text-[11px] text-[#595750] mb-1.5">
                  Menunjukkan posisi harga saat ini terhadap batas pita atas (%B = 1.0) dan pita bawah (%B = 0.0).
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#121316] font-bold">%B &gt; 0.80</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Harga berada di batas atas distribusi statistik 20 hari.</p>
                  </div>
                  <div className="p-1.5 bg-[#FAF9F6] border border-[#E5E3DC]">
                    <span className="text-[#1B5E20] font-bold">%B &lt; 0.20</span>
                    <p className="text-[#737168] text-[9px] mt-0.5">Harga berada di batas bawah pita (area diskon statistik).</p>
                  </div>
                </div>
              </div>

              {/* Volatilitas Tahunan */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-[#121316]">Volatilitas Tahunan (Annual Volatility)</span>
                  <span className="font-mono text-[10px] text-[#737168]">Standar Deviasi Teranualisasi</span>
                </div>
                <p className="text-[11px] text-[#595750]">
                  Mengukur rentang rata-rata fluktuasi harian. Saham dengan volatilitas tinggi (&gt;35%) memiliki pergerakan harga lebar yang memerlukan penyesuaian risiko lebih ketat. Volatilitas rendah (&lt;20%) menunjukkan konsolidasi stabil.
                </p>
              </div>

              {/* Sentimen Berita */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-[#121316]">Sentimen Berita & Katalis</span>
                  <span className="font-mono text-[10px] text-[#737168]">Skor -1.0 hingga +1.0</span>
                </div>
                <p className="text-[11px] text-[#595750]">
                  Skor polaritas dari analisis leksikal berita emiten (dividen, laba bersih, ekspansi bisnis vs penurunan kinerja, beban utang, litigasi hukum).
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 3: ML SIGNALS AND RISK */}
          <section className="bg-white border border-[#121316] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2 mb-3">
              <h3 className="font-editorial font-bold text-base text-[#121316]">
                3. Korelasi ke Sinyal Forecast
              </h3>
              <span className="font-mono text-[10px] text-[#737168] uppercase">Output Model</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 border-l-2 border-l-[#1B5E20] border-t border-r border-b border-[#E5E3DC] bg-[#FAF9F6]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-[#1B5E20]">BELI (BULLISH)</span>
                  <span className="font-mono text-[10px] text-[#737168]">Probabilitas Model &gt; 65%</span>
                </div>
                <p className="text-[#595750] text-[11px]">
                  Dihasilkan saat tren Moving Average naik, akselerasi MACD positif, RSI berada pada rentang ekspansi sehat, dan sentimen berita netral hingga positif.
                </p>
              </div>

              <div className="p-3 border-l-2 border-l-[#121316] border-t border-r border-b border-[#E5E3DC] bg-[#FAF9F6]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-[#121316]">TUNGGU (NETRAL)</span>
                  <span className="font-mono text-[10px] text-[#737168]">Kondisi Konsolidasi</span>
                </div>
                <p className="text-[#595750] text-[11px]">
                  Dihasilkan saat indikator teknikal saling bertentangan (misalnya pergerakan harga tanpa volume pendukung atau pasar bergerak <em>sideways</em>). Model merekomendasikan observasi.
                </p>
              </div>

              <div className="p-3 border-l-2 border-l-[#B71C1C] border-t border-r border-b border-[#E5E3DC] bg-[#FAF9F6]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-[#B71C1C]">WASPADA (BEARISH)</span>
                  <span className="font-mono text-[10px] text-[#737168]">Risiko Koreksi</span>
                </div>
                <p className="text-[#595750] text-[11px]">
                  Dihasilkan saat harga menembus support rata-rata bergerak ke bawah, momentum MACD negatif, atau muncul katalis penurunan yang signifikan.
                </p>
              </div>
            </div>

            {/* Dynamic Recalibration Note */}
            <div className="mt-3.5 p-3 border border-[#121316] bg-[#F1EFEA] text-[11px]">
              <span className="font-mono font-bold text-[#121316] block mb-0.5">
                Rekalibrasi Sentimen Real-Time (Dinamis & Fleksibel)
              </span>
              <p className="text-[#595750] leading-relaxed">
                Prediksi tidak bersifat kaku atau statis. Apabila muncul katalis berita baru (misalnya lonjakan dividen atau sebaliknya penurunan kinerja/litigasi), mesin secara aktif menghitung ulang probabilitas ML dan proyeksi imbal hasil, sehingga sinyal dapat langsung menyesuaikan secara adaptif.
              </p>
            </div>

            {/* Walk-Forward Note */}
            <div className="mt-2.5 p-3 border border-[#121316] bg-[#FAF9F6] text-[11px]">
              <span className="font-mono font-bold text-[#121316] block mb-0.5">
                Validasi Walk-Forward (Simulasi Buta Tanpa Lookahead Bias)
              </span>
              <p className="text-[#595750] leading-relaxed">
                Model diuji pada data masa lalu secara berurutan menggunakan jendela 20 hari tanpa memberikan akses ke data masa depan. Metrik <strong>Win Rate</strong> menunjukkan rasio keberhasilan sinyal pada simulasi pengujian tersebut.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-[#121316] p-3 sm:px-6 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-mono text-[#737168]">
            © StockfishZ
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#121316] text-white hover:bg-black font-sans text-xs font-medium transition active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
