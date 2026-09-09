import React, { useState, useEffect, useRef } from "react";
import { Star, Sparkles } from "lucide-react";
import HoldingIcon from "./components/HoldingIcon";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import TickerList, { formatRupiah } from "./components/TickerList";
import PredictionCard, { COMPANY_NAMES } from "./components/PredictionCard";
import StockChart from "./components/StockChart";
import KeyFactors from "./components/KeyFactors";
import NewsFeed from "./components/NewsFeed";
import PortfolioModal from "./components/PortfolioModal";
import HowItWorksModal from "./components/HowItWorksModal";
import NotificationCenterModal from "./components/NotificationCenterModal";
import PortfolioDashboard from "./components/PortfolioDashboard";
import SectorHeatmap from "./components/SectorHeatmap";

import { usePredictions } from "./hooks/usePredictions";
import { usePortfolio } from "./hooks/usePortfolio";
import { useFavorites } from "./hooks/useFavorites";
import { useNotifications } from "./hooks/useNotifications";

export default function App() {
  const [activeTab, setActiveTab] = useState("signals");
  const scrollContainerRef = useRef(null);

  // Scroll-to-top helper — scrolls the app container (not window, since body is position:fixed)
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  // Portfolio Modal Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState("BBCA.JK");

  // How It Works Educational Modal State
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [howItWorksChapter, setHowItWorksChapter] = useState(null);

  // Hook 1: Favorites
  const { favorites, toggleFavorite, addFavorite } = useFavorites();

  // Hook 2: Portfolio
  const { portfolio, savePortfolioHolding, deletePortfolioHolding } = usePortfolio({
    onHoldingAdded: (ticker) => addFavorite(ticker),
  });

  // Universal stock selector that resets scroll to the very top
  const handleSelectStock = (ticker, switchTab = true) => {
    if (!ticker) return;
    setSelectedTicker(ticker);
    if (switchTab) {
      setActiveTab("signals");
    }
    scrollToTop();
  };

  // Hook 3: Predictions (data, polling at 30min, priority sorting, search)
  const {
    predictions,
    selectedTicker,
    setSelectedTicker,
    loading,
    isRefreshing,
    isAddingTicker,
    errorMessage,
    fetchPredictions,
    handleAddCustomTicker,
    sortedPredictions,
  } = usePredictions({
    portfolio,
    favorites,
    onSelectStock: (t) => handleSelectStock(t, true),
  });

  // Hook 4: Notifications (lifecycle, stop-loss/take-profit, cooldowns, history)
  const {
    notifications,
    unreadNotifCount,
    isNotifModalOpen,
    setIsNotifModalOpen,
    handleClearAllNotifications,
    handleMarkAllNotificationsAsRead,
  } = useNotifications({
    predictions,
    portfolio,
    favorites,
    onSelectStock: (t) => handleSelectStock(t, true),
    onFetchPredictions: fetchPredictions,
  });

  // Always reset scroll to the top when selectedTicker or activeTab changes
  useEffect(() => {
    scrollToTop();
  }, [selectedTicker, activeTab]);

  const handleOpenHowItWorks = (chapter = null) => {
    setHowItWorksChapter(chapter);
    setIsHowItWorksOpen(true);
  };

  const handleSaveHolding = (ticker, holdingData) => {
    savePortfolioHolding(ticker, holdingData);
    setSelectedTicker(ticker);
  };

  const activePrediction =
    predictions.find((p) => p.ticker === selectedTicker) ||
    sortedPredictions[0] ||
    predictions[0];

  const activeHolding = activePrediction ? portfolio[activePrediction.ticker] : null;

  return (
    <div ref={scrollContainerRef} className="w-full max-w-full h-full overflow-y-auto overflow-x-hidden overscroll-y-none overscroll-x-none bg-[#F8F7F4] text-[#121316] flex flex-col justify-between selection:bg-[#E5E3DC]">
      <div>
        <Header
          onRefresh={fetchPredictions}
          isRefreshing={isRefreshing}
          onAddCustomTicker={handleAddCustomTicker}
          isAddingTicker={isAddingTicker}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenHowItWorks={() => handleOpenHowItWorks(null)}
          unreadNotifCount={unreadNotifCount}
          onOpenNotifications={() => setIsNotifModalOpen(true)}
        />

        {errorMessage && (
          <div className="max-w-2xl mx-auto px-4 mt-2">
            <div className="p-2.5 bg-[#FFEBEE] border border-[#B71C1C] text-[#B71C1C] text-xs font-mono">
              [PERINGATAN] {errorMessage}
            </div>
          </div>
        )}

        <main className="max-w-2xl mx-auto px-3.5 sm:px-4 py-3.5 sm:py-4">
          {loading ? (
            <div className="text-center py-20 font-mono text-xs text-[#737168]">
              Memuat Data Saham & Sentimen Bibit (BEI)...
            </div>
          ) : activeTab === "signals" ? (
            <div className="space-y-3.5 sm:space-y-4">
              <TickerList
                predictions={sortedPredictions}
                selectedTicker={selectedTicker}
                onSelectTicker={(t) => handleSelectStock(t, false)}
                favorites={favorites}
                portfolio={portfolio}
              />
              {activePrediction && (
                <>
                  <PredictionCard
                    prediction={activePrediction}
                    isFavorite={favorites.includes(activePrediction.ticker)}
                    onToggleFavorite={toggleFavorite}
                    holding={activeHolding}
                    onOpenPortfolioModal={() => {
                      setModalTicker(activePrediction.ticker);
                      setIsModalOpen(true);
                    }}
                  />
                  <StockChart
                    prediction={activePrediction}
                    holding={activeHolding}
                  />
                  <KeyFactors
                    factors={activePrediction.key_factors}
                    onOpenHowItWorks={handleOpenHowItWorks}
                  />
                  <NewsFeed
                    ticker={activePrediction.ticker}
                    newsSentiment={activePrediction.news_sentiment}
                  />
                </>
              )}
            </div>
          ) : activeTab === "portfolio" ? (
            <PortfolioDashboard
              predictions={predictions}
              portfolio={portfolio}
              onOpenPortfolioModal={(ticker) => {
                setModalTicker(ticker || selectedTicker);
                setIsModalOpen(true);
              }}
              onSelectStock={(ticker) => handleSelectStock(ticker, true)}
              onDeleteHolding={deletePortfolioHolding}
            />
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {/* Sector Heatmap rendered directly above the stock list / watchlist */}
              <SectorHeatmap
                predictions={predictions}
                onSelectStock={(ticker) => handleSelectStock(ticker, true)}
              />

              <div className="bg-white border border-[#121316] p-3.5 sm:p-5 mb-8 shadow-xs">
                {/* Header List Saham */}
                <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-3 mb-3">
                  <div>
                    <span className="font-mono text-xs font-bold uppercase text-[#121316] block">
                      Daftar Saham Aktif ({predictions.length})
                    </span>
                    <span className="text-[10px] text-[#737168] font-mono">Bursa Efek Indonesia (IDX)</span>
                  </div>
                  <div className="flex items-center space-x-2.5 text-[10px] font-mono text-[#737168]">
                    <span className="flex items-center">
                      <HoldingIcon className="w-3.5 h-3.5 mr-1" color="#1B5E20" /> Portofolio
                    </span>
                    <span className="flex items-center">
                      <Star className="w-3.5 h-3.5 text-[#D97706] fill-[#D97706] mr-1" /> Favorit
                    </span>
                  </div>
                </div>

                {/* Mobile View: Native Stock Rows (< md) */}
                <div className="md:hidden divide-y divide-[#E5E3DC]">
                  {sortedPredictions.map((item) => {
                    const isBull = item.signal.toLowerCase().includes("beli") || item.signal.toLowerCase().includes("bull");
                    const isBear = item.signal.toLowerCase().includes("waspada") || item.signal.toLowerCase().includes("bear");
                    const isBought = Boolean(portfolio[item.ticker]);
                    const isFav = favorites.includes(item.ticker);
                    const cleanTicker = item.ticker.replace(".JK", "");
                    const companyName = COMPANY_NAMES[item.ticker] || `${cleanTicker} • Emiten BEI`;

                    return (
                      <div
                        key={item.ticker}
                        onClick={() => handleSelectStock(item.ticker, true)}
                        className="py-3 px-2 sm:px-3 flex items-center justify-between hover:bg-[#FAF9F6] active:bg-[#F1EFEA] transition cursor-pointer min-h-[58px]"
                      >
                        {/* Left: Icon + Ticker + Company Name */}
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          {isBought ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTicker(item.ticker);
                                setIsModalOpen(true);
                              }}
                              className="p-2 hover:bg-[#E8F5E9] rounded shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                              title="Saham Dimiliki di Portofolio (Klik untuk ubah)"
                            >
                              <HoldingIcon className="w-4 h-4" color="#1B5E20" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.ticker);
                              }}
                              className="p-2 hover:bg-[#E5E3DC] rounded shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                              title={isFav ? "Hapus Favorit" : "Sematkan ke Favorit"}
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  isFav ? "text-[#D97706] fill-[#D97706]" : "text-[#DCDAD4]"
                                }`}
                              />
                            </button>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                              <span className="font-editorial font-bold text-base text-[#121316] tracking-tight">
                                {cleanTicker}
                              </span>
                              {isBought && (
                                <span className="text-[10px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1.5 py-0.5 border border-[#1B5E20]/30 uppercase">
                                  Dimiliki
                                </span>
                              )}
                              {item.action_alert?.type === "PRIME_BUY" && (
                                <span className="text-[10px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1.5 py-0.5 border border-[#1B5E20] uppercase flex items-center" title="Prospek Bagus: Konfluensi momentum dan sentimen positif terkonfirmasi">
                                  <Sparkles className="w-3 h-3 mr-0.5 text-[#1B5E20]" />
                                  Prospek Bagus
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#737168] truncate max-w-[140px] font-sans">
                              {companyName}
                            </p>
                          </div>
                        </div>

                        {/* Right: Current Price + Target / Sinyal Badge */}
                        <div className="text-right shrink-0">
                          <div className="font-mono-num font-bold text-sm text-[#121316]">
                            {formatRupiah(item.current_price)}
                          </div>
                          <div className="flex items-center justify-end space-x-1.5 mt-0.5">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                                isBull
                                  ? "text-[#1B5E20] border-[#1B5E20]/30 bg-[#E8F5E9]"
                                  : isBear
                                  ? "text-[#B71C1C] border-[#B71C1C]/30 bg-[#FFEBEE]"
                                  : "text-[#5D4037] border-[#5D4037]/30 bg-[#EFEBE9]"
                              }`}
                            >
                              {item.signal.split(" ")[0]}
                            </span>
                            <span
                              className={`font-mono-num text-xs font-bold ${
                                item.expected_return_pct >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
                              }`}
                            >
                              {item.expected_return_pct >= 0 ? "+" : ""}
                              {item.expected_return_pct}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Full Table (md+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans border-collapse">
                    <thead>
                      <tr className="border-b border-[#121316] text-[10px] uppercase text-[#737168]">
                        <th className="py-2 w-8 text-center">Status</th>
                        <th className="py-2">Kode Saham</th>
                        <th className="py-2">Nama Perusahaan</th>
                        <th className="py-2">Harga Saat Ini</th>
                        <th className="py-2">Sinyal ML</th>
                        <th className="py-2 text-right">Keyakinan</th>
                        <th className="py-2 text-right">Target 20 Hari</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E3DC]">
                      {sortedPredictions.map((item) => {
                        const isBull = item.signal.toLowerCase().includes("beli") || item.signal.toLowerCase().includes("bull");
                        const isBear = item.signal.toLowerCase().includes("waspada") || item.signal.toLowerCase().includes("bear");
                        const isBought = Boolean(portfolio[item.ticker]);
                        const isFav = favorites.includes(item.ticker);
                        const cleanTicker = item.ticker.replace(".JK", "");
                        const companyName = COMPANY_NAMES[item.ticker] || `${cleanTicker} • Emiten BEI`;

                        return (
                          <tr
                            key={item.ticker}
                            onClick={() => handleSelectStock(item.ticker, true)}
                            className="hover:bg-[#FAF9F6] transition cursor-pointer"
                          >
                            <td className="py-2.5 text-center">
                              {isBought ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModalTicker(item.ticker);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-[#E8F5E9] rounded flex items-center justify-center mx-auto"
                                  title="Saham Dimiliki di Portofolio (Klik untuk edit)"
                                >
                                  <HoldingIcon className="w-3.5 h-3.5" color="#1B5E20" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(item.ticker);
                                  }}
                                  className="p-1 hover:bg-[#E5E3DC] rounded"
                                  title={isFav ? "Hapus Favorit" : "Sematkan ke Favorit"}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      isFav ? "text-[#D97706] fill-[#D97706]" : "text-[#DCDAD4]"
                                    }`}
                                  />
                                </button>
                              )}
                            </td>
                            <td
                              className="py-2.5 font-bold font-editorial"
                            >
                              <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                                <span className="text-sm">{cleanTicker}</span>
                                {isBought && (
                                  <span className="text-[10px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1.5 py-0.5 border border-[#1B5E20]/30 uppercase">
                                    Dimiliki
                                  </span>
                                )}
                                {item.action_alert?.type === "PRIME_BUY" && (
                                  <span className="text-[10px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1.5 py-0.5 border border-[#1B5E20] uppercase flex items-center" title="Prospek Bagus: Konfluensi momentum dan sentimen positif terkonfirmasi">
                                    <Sparkles className="w-3 h-3 mr-0.5 text-[#1B5E20]" />
                                    Prospek Bagus
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className="py-2.5 text-[11px] text-[#595750] truncate max-w-[180px]"
                            >
                              {companyName}
                            </td>
                            <td
                              className="py-2.5 font-mono-num"
                            >
                              {formatRupiah(item.current_price)}
                            </td>
                            <td
                              className="py-2.5"
                            >
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                                  isBull ? "text-[#1B5E20]" : isBear ? "text-[#B71C1C]" : "text-[#5D4037]"
                                }`}
                              >
                                {item.signal}
                              </span>
                            </td>
                            <td
                              className="py-2.5 font-mono-num text-right"
                            >
                              {item.confidence}%
                            </td>
                            <td
                              className={`py-2.5 font-mono-num font-bold text-right ${
                                item.expected_return_pct >= 0 ? "text-[#1B5E20]" : "text-[#B71C1C]"
                              }`}
                            >
                              {item.expected_return_pct >= 0 ? "+" : ""}
                              {item.expected_return_pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Main Page Footer */}
      <footer className="py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 border-t border-[#E5E3DC] text-center bg-[#FAF9F6] mt-6">
        <span className="text-[11px] font-mono text-[#737168]">
          © StockfishZ
        </span>
      </footer>

      {/* Fixed Bottom Navigation for Mobile */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Portfolio Modal Dialog */}
      <PortfolioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ticker={modalTicker}
        currentPrice={predictions.find((p) => p.ticker === modalTicker)?.current_price || 0}
        existingHolding={portfolio[modalTicker]}
        onSave={handleSaveHolding}
        onDelete={deletePortfolioHolding}
      />

      {/* How ChartsOff Works Educational Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => {
          setIsHowItWorksOpen(false);
          setHowItWorksChapter(null);
        }}
        initialChapter={howItWorksChapter}
      />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
        onSelectTicker={(t) => handleSelectStock(t, true)}
        onClearAll={handleClearAllNotifications}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
      />
    </div>
  );
}
