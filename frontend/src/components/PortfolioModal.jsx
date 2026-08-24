import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import HoldingIcon from "./HoldingIcon";
import { formatRupiah } from "./TickerList";

export default function PortfolioModal({
  isOpen,
  onClose,
  ticker,
  currentPrice,
  existingHolding,
  onSave,
  onDelete,
}) {
  const [buyPrice, setBuyPrice] = useState("");
  const [lots, setLots] = useState("1");
  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (existingHolding) {
      setBuyPrice(existingHolding.buyPrice || currentPrice || "");
      setLots(existingHolding.lots || "1");
      setBuyDate(existingHolding.buyDate || new Date().toISOString().split("T")[0]);
    } else {
      setBuyPrice(currentPrice || "");
      setLots("1");
      setBuyDate(new Date().toISOString().split("T")[0]);
    }
  }, [existingHolding, currentPrice, isOpen]);

  if (!isOpen) return null;

  const cleanTicker = ticker ? ticker.replace(".JK", "") : "";
  const numPrice = parseFloat(buyPrice) || 0;
  const numLots = parseInt(lots, 10) || 0;
  const totalShares = numLots * 100;
  const totalCost = numPrice * totalShares;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (numPrice <= 0 || numLots <= 0) return;

    onSave(ticker, {
      ticker,
      buyPrice: numPrice,
      lots: numLots,
      shares: totalShares,
      buyDate: buyDate || new Date().toISOString().split("T")[0],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border-2 border-[#121316] w-full max-w-md p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <HoldingIcon className="w-5 h-5" color="#1B5E20" />
            <div>
              <h3 className="font-editorial font-bold text-lg text-[#121316]">
                {existingHolding ? "Edit Portofolio Saham" : "Catat Pembelian Saham"}
              </h3>
              <p className="text-[11px] font-mono text-[#737168]">
                {cleanTicker} • Harga Pasar Saat Ini: {formatRupiah(currentPrice)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F1EFEA] border border-transparent hover:border-[#121316] text-[#737168] hover:text-[#121316]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Input */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-sans">
          {/* Harga Beli Per Lembar */}
          <div>
            <label className="block font-mono uppercase text-[10px] text-[#595750] font-bold mb-1">
              Harga Beli Per Lembar (Rp)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Contoh: 9800"
              required
              className="w-full px-3 py-2 border border-[#121316] font-mono text-sm bg-[#FAF9F6] text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#121316]"
            />
          </div>

          {/* Jumlah Lot */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-mono uppercase text-[10px] text-[#595750] font-bold">
                Jumlah Lot (1 Lot = 100 Lembar)
              </label>
              <span className="font-mono text-[10px] text-[#737168]">
                = {totalShares.toLocaleString("id-ID")} Lembar
              </span>
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={lots}
              onChange={(e) => setLots(e.target.value)}
              placeholder="Contoh: 10"
              required
              className="w-full px-3 py-2 border border-[#121316] font-mono text-sm bg-[#FAF9F6] text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#121316]"
            />
          </div>

          {/* Tanggal Pembelian */}
          <div>
            <label className="block font-mono uppercase text-[10px] text-[#595750] font-bold mb-1">
              Tanggal Pembelian
            </label>
            <input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#121316] font-mono text-xs bg-[#FAF9F6] text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#121316]"
            />
          </div>

          {/* Kalkulasi Total Modal Investasi */}
          <div className="p-3 bg-[#FAF9F6] border border-[#DCDAD4] space-y-1">
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-[#737168]">Total Modal Pembelian:</span>
              <span className="font-bold text-[#121316]">{formatRupiah(totalCost)}</span>
            </div>
            {currentPrice && (
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[#737168]">Estimasi Nilai Sekarang:</span>
                <span className="font-bold text-[#121316]">
                  {formatRupiah(currentPrice * totalShares)}
                </span>
              </div>
            )}
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-between pt-2">
            {existingHolding && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(ticker);
                  onClose();
                }}
                className="px-3 py-2 border border-[#B71C1C] text-[#B71C1C] hover:bg-[#FFEBEE] font-mono text-[11px] flex items-center space-x-1 transition active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Portofolio</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 border border-[#121316] text-[#121316] hover:bg-[#F1EFEA] font-mono text-[11px] transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#121316] text-white hover:bg-black font-mono font-bold text-[11px] transition active:scale-95 shadow"
              >
                Simpan ke Portofolio
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
