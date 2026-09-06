import React, { useState, useMemo } from "react";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  ArrowUpRight,
  PieChart,
  ShieldCheck,
  Calendar,
  AlertTriangle
} from "lucide-react";
import HoldingIcon from "./HoldingIcon";
import { formatRupiah } from "./TickerList";
import { COMPANY_NAMES } from "./PredictionCard";

export default function PortfolioDashboard({
  predictions = [],
  portfolio = {},
  onOpenPortfolioModal,
  onSelectStock,
  onDeleteHolding,
}) {
  const [tickerToAdd, setTickerToAdd] = useState("");
  const [confirmDeleteTicker, setConfirmDeleteTicker] = useState(null);

  // Compute holdings array and metrics
  const holdingsList = useMemo(() => {
    const tickers = Object.keys(portfolio || {});
    return tickers.map((ticker) => {
      const holding = portfolio[ticker];
      const pred = predictions.find((p) => p.ticker === ticker);
      const clean = ticker.replace(".JK", "");
      const companyName = COMPANY_NAMES[ticker] || `${clean} • Emiten BEI`;

      const buyPrice = Number(holding.buyPrice) || 0;
      const lots = Number(holding.lots) || 1;
      const shares = Number(holding.shares) || lots * 100;
      const currentPrice = Number(pred?.current_price) || buyPrice;

      const totalCost = buyPrice * shares;
      const currentValue = currentPrice * shares;
      const unrealizedPnl = currentValue - totalCost;
      const pnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

      return {
        ticker,
        cleanTicker: clean,
        companyName,
        buyPrice,
        lots,
        shares,
        currentPrice,
        totalCost,
        currentValue,
        unrealizedPnl,
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        buyDate: holding.buyDate || "-",
        signal: pred?.signal || "Hold",
        actionAlert: pred?.action_alert,
        expectedReturn: pred?.expected_return_pct,
        riskManagement: pred?.risk_management,
      };
    });
  }, [portfolio, predictions]);

  // Aggregate Portfolio Metrics
  const summary = useMemo(() => {
    let totalCost = 0;
    let totalValuation = 0;
    let totalLots = 0;

    holdingsList.forEach((h) => {
      totalCost += h.totalCost;
      totalValuation += h.currentValue;
      totalLots += h.lots;
    });

    const totalPnl = totalValuation - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return {
      totalCost,
      totalValuation,
      totalLots,
      totalHoldings: holdingsList.length,
      totalPnl,
      totalPnlPct: parseFloat(totalPnlPct.toFixed(2)),
    };
  }, [holdingsList]);

  const handleStartAddTransaction = (e) => {
    e.preventDefault();
    if (!tickerToAdd.trim()) return;
    let clean = tickerToAdd.trim().toUpperCase();
    if (!clean.endsWith(".JK")) clean = `${clean}.JK`;
    if (onOpenPortfolioModal) {
      onOpenPortfolioModal(clean);
    }
    setTickerToAdd("");
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Top Banner & Summary Cards */}
      <div className="bg-white border border-[#121316] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E5E3DC]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#FAF9F6] border border-[#121316]">
              <Briefcase className="w-5 h-5 text-[#121316]" />
            </div>
            <div>
              <h2 className="font-editorial font-bold text-lg text-[#121316]">
                Portofolio Saham & P&L Real-Time
              </h2>
              <p className="text-[11px] font-mono text-[#737168]">
                Bursa Efek Indonesia • Pantauan Keuntungan & Valuasi Investasi
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <button
            type="button"
            onClick={() => {
              const defaultPick = predictions[0]?.ticker || "BBCA.JK";
              if (onOpenPortfolioModal) onOpenPortfolioModal(defaultPick);
            }}
            className="px-3 py-2 bg-[#121316] text-white hover:bg-black font-sans text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Catat Beli Saham</span>
          </button>
        </div>

        {/* 3 Summary Statistic Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {/* Card 1: Valuasi Saat Ini */}
          <div className="p-3.5 bg-[#FAF9F6] border border-[#121316]/20">
            <span className="font-mono uppercase text-[10px] text-[#737168] font-bold block mb-1">
              Total Valuasi Portofolio
            </span>
            <div className="font-mono-num font-bold text-xl sm:text-2xl text-[#121316] tracking-tight">
              {formatRupiah(summary.totalValuation)}
            </div>
            <div className="text-[10px] font-mono text-[#737168] mt-1">
              {summary.totalHoldings} Saham • {summary.totalLots} Lot Terdaftar
            </div>
          </div>

          {/* Card 2: Modal Diinvestasikan */}
          <div className="p-3.5 bg-[#FAF9F6] border border-[#121316]/20">
            <span className="font-mono uppercase text-[10px] text-[#737168] font-bold block mb-1">
              Total Modal Pembelian (Cost)
            </span>
            <div className="font-mono-num font-bold text-xl sm:text-2xl text-[#595750] tracking-tight">
              {formatRupiah(summary.totalCost)}
            </div>
            <div className="text-[10px] font-mono text-[#737168] mt-1">
              Dasar kalkulasi laba/rugi
            </div>
          </div>

          {/* Card 3: Unrealized P&L */}
          <div
            className={`p-3.5 border ${
              summary.totalPnl >= 0
                ? "bg-[#E8F5E9] border-[#1B5E20]/40"
                : "bg-[#FFEBEE] border-[#B71C1C]/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono uppercase text-[10px] font-bold block ${
                  summary.totalPnl >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
                }`}
              >
                Total Keuntungan / Kerugian (P&L)
              </span>
              {summary.totalPnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-[#1B5E20]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-[#B71C1C]" />
              )}
            </div>
            <div
              className={`font-mono-num font-bold text-xl sm:text-2xl tracking-tight mt-0.5 ${
                summary.totalPnl >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
              }`}
            >
              {summary.totalPnl >= 0 ? "+" : ""}
              {formatRupiah(summary.totalPnl)}
            </div>
            <div
              className={`text-xs font-mono font-bold mt-1 ${
                summary.totalPnl >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
              }`}
            >
              {summary.totalPnlPct >= 0 ? "+" : ""}
              {summary.totalPnlPct}% Return Modal
            </div>
          </div>
        </div>
      </div>

      {/* Holdings List / Table Section */}
      <div className="bg-white border border-[#121316] p-3.5 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E3DC] mb-3">
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#121316] block">
              Daftar Kepemilikan Saham ({holdingsList.length})
            </span>
            <span className="text-[10px] text-[#737168] font-mono">
              Klik emiten untuk melihat sinyal kuantitatif & grafik teknikal
            </span>
          </div>
        </div>

        {/* Empty State */}
        {holdingsList.length === 0 ? (
          <div className="py-12 px-4 text-center bg-[#FAF9F6] border border-dashed border-[#DCDAD4] my-2">
            <div className="w-12 h-12 mx-auto mb-3 bg-[#E5E3DC]/50 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-[#737168]" />
            </div>
            <h3 className="font-editorial font-bold text-base text-[#121316] mb-1">
              Portofolio Masih Kosong
            </h3>
            <p className="text-xs text-[#737168] max-w-md mx-auto mb-4 font-sans">
              Catat saham yang Anda miliki untuk memantau valuasi dan keuntungan secara otomatis,
              serta mendapatkan peringatan dini jika harga menyentuh batas Target atau Stop-Loss.
            </p>
            <button
              type="button"
              onClick={() => {
                const defaultPick = predictions[0]?.ticker || "BBCA.JK";
                if (onOpenPortfolioModal) onOpenPortfolioModal(defaultPick);
              }}
              className="px-4 py-2 bg-[#121316] text-white hover:bg-black font-sans text-xs font-medium inline-flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Pembelian Pertama</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-[#E5E3DC]">
              {holdingsList.map((h) => {
                const isProfit = h.unrealizedPnl >= 0;
                return (
                  <div
                    key={h.ticker}
                    className="py-3 px-1.5 flex flex-col gap-2 hover:bg-[#FAF9F6] transition"
                  >
                    {/* Card Top: Ticker, Company, Action Buttons */}
                    <div className="flex items-start justify-between">
                      <div
                        onClick={() => onSelectStock && onSelectStock(h.ticker)}
                        className="cursor-pointer group flex items-start space-x-2"
                      >
                        <div className="p-1.5 bg-[#E8F5E9] border border-[#1B5E20]/30 rounded shrink-0 mt-0.5">
                          <HoldingIcon className="w-3.5 h-3.5" color="#1B5E20" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-editorial font-bold text-base text-[#121316] group-hover:underline">
                              {h.cleanTicker}
                            </span>
                            <span className="text-[10px] font-mono font-semibold bg-[#FAF9F6] border border-[#121316]/20 px-1.5 py-0.5">
                              {h.lots} Lot ({h.shares.toLocaleString("id-ID")} lbr)
                            </span>
                          </div>
                          <p className="text-[11px] text-[#737168] truncate max-w-[170px]">
                            {h.companyName}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons: Edit, Delete */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => onOpenPortfolioModal && onOpenPortfolioModal(h.ticker)}
                          className="p-1.5 text-[#595750] hover:text-[#121316] hover:bg-[#E5E3DC] rounded transition"
                          title="Edit transaksi"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTicker(h.ticker)}
                          className="p-1.5 text-[#B71C1C] hover:bg-[#FFEBEE] rounded transition"
                          title="Hapus dari portofolio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Mid: Harga Beli vs Harga Saat Ini */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF9F6] p-2 border border-[#E5E3DC]">
                      <div>
                        <span className="text-[10px] font-mono text-[#737168] block">Harga Beli</span>
                        <span className="font-mono-num font-bold text-xs sm:text-sm text-[#595750]">
                          {formatRupiah(h.buyPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[#737168] block">Harga Terkini</span>
                        <span className="font-mono-num font-bold text-xs sm:text-sm text-[#121316]">
                          {formatRupiah(h.currentPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[#737168] block">Total Modal</span>
                        <span className="font-mono-num text-xs text-[#737168]">
                          {formatRupiah(h.totalCost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[#737168] block">Nilai Sekarang</span>
                        <span className="font-mono-num font-bold text-xs sm:text-sm text-[#121316]">
                          {formatRupiah(h.currentValue)}
                        </span>
                      </div>
                    </div>

                    {/* Card Bottom: P&L Summary + View Signal Button */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-[11px] font-mono text-[#737168]">P&L:</span>
                        <span
                          className={`font-mono-num font-bold text-xs sm:text-sm ${
                            isProfit ? "text-[#1B5E20]" : "text-[#B71C1C]"
                          }`}
                        >
                          {isProfit ? "+" : ""}
                          {formatRupiah(h.unrealizedPnl)} ({isProfit ? "+" : ""}{h.pnlPct}%)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectStock && onSelectStock(h.ticker)}
                        className="text-[11px] font-mono font-bold text-[#121316] hover:underline flex items-center"
                      >
                        Analisis →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-[#121316] text-[10px] uppercase text-[#737168]">
                    <th className="py-2.5">Kode Saham</th>
                    <th className="py-2.5">Perusahaan</th>
                    <th className="py-2.5 text-right">Lot (Lembar)</th>
                    <th className="py-2.5 text-right">Rata-rata Beli</th>
                    <th className="py-2.5 text-right">Harga Saat Ini</th>
                    <th className="py-2.5 text-right">Total Nilai</th>
                    <th className="py-2.5 text-right">Laba/Rugi (P&L)</th>
                    <th className="py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E3DC]">
                  {holdingsList.map((h) => {
                    const isProfit = h.unrealizedPnl >= 0;
                    return (
                      <tr
                        key={h.ticker}
                        className="hover:bg-[#FAF9F6] transition cursor-pointer"
                        onClick={() => onSelectStock && onSelectStock(h.ticker)}
                      >
                        <td className="py-3 font-editorial font-bold text-sm text-[#121316]">
                          <div className="flex items-center space-x-1.5">
                            <HoldingIcon className="w-3.5 h-3.5" color="#1B5E20" />
                            <span>{h.cleanTicker}</span>
                          </div>
                        </td>
                        <td className="py-3 text-[11px] text-[#595750] truncate max-w-[160px]">
                          {h.companyName}
                        </td>
                        <td className="py-3 font-mono-num text-right">
                          <span className="font-bold">{h.lots}</span> Lot
                          <span className="text-[10px] text-[#737168] block">
                            ({h.shares.toLocaleString("id-ID")} lbr)
                          </span>
                        </td>
                        <td className="py-3 font-mono-num text-right text-[#595750]">
                          {formatRupiah(h.buyPrice)}
                        </td>
                        <td className="py-3 font-mono-num font-bold text-right text-[#121316]">
                          {formatRupiah(h.currentPrice)}
                        </td>
                        <td className="py-3 font-mono-num font-bold text-right text-[#121316]">
                          {formatRupiah(h.currentValue)}
                        </td>
                        <td className="py-3 font-mono-num font-bold text-right">
                          <div className={isProfit ? "text-[#1B5E20]" : "text-[#B71C1C]"}>
                            {isProfit ? "+" : ""}
                            {formatRupiah(h.unrealizedPnl)}
                          </div>
                          <span
                            className={`text-[10px] font-mono px-1 py-0.2 rounded-xs inline-block mt-0.5 ${
                              isProfit
                                ? "bg-[#E8F5E9] text-[#1B5E20]"
                                : "bg-[#FFEBEE] text-[#B71C1C]"
                            }`}
                          >
                            {isProfit ? "+" : ""}
                            {h.pnlPct}%
                          </span>
                        </td>
                        <td
                          className="py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => onOpenPortfolioModal && onOpenPortfolioModal(h.ticker)}
                              className="p-1.5 hover:bg-[#E5E3DC] text-[#595750] hover:text-[#121316] rounded transition cursor-pointer"
                              title="Edit Transaksi"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTicker(h.ticker)}
                              className="p-1.5 hover:bg-[#FFEBEE] text-[#B71C1C] rounded transition cursor-pointer"
                              title="Hapus dari Portofolio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteTicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-[#121316] p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center space-x-2 text-[#B71C1C] mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-editorial font-bold text-base text-[#121316]">
                Hapus Saham Portofolio?
              </h4>
            </div>
            <p className="text-xs font-sans text-[#595750] mb-4">
              Apakah Anda yakin ingin menghapus catatan saham{" "}
              <strong className="text-[#121316] font-mono">
                {confirmDeleteTicker.replace(".JK", "")}
              </strong>{" "}
              dari portofolio?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTicker(null)}
                className="px-3 py-1.5 border border-[#121316] text-xs font-sans hover:bg-[#FAF9F6] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteHolding) onDeleteHolding(confirmDeleteTicker);
                  setConfirmDeleteTicker(null);
                }}
                className="px-3 py-1.5 bg-[#B71C1C] text-white text-xs font-sans hover:bg-[#991B1B] cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
