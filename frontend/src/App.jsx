import React, { useState, useEffect, useMemo, useRef } from "react";
import { Star, Sparkles } from "lucide-react";
import HoldingIcon from "./components/HoldingIcon";
import Header from "./components/Header";
import TickerList, { formatRupiah } from "./components/TickerList";
import PredictionCard, { COMPANY_NAMES } from "./components/PredictionCard";
import StockChart from "./components/StockChart";
import KeyFactors from "./components/KeyFactors";
import NewsFeed from "./components/NewsFeed";
import PortfolioModal from "./components/PortfolioModal";
import HowItWorksModal from "./components/HowItWorksModal";
import NotificationCenterModal from "./components/NotificationCenterModal";
import { NotificationService } from "./services/notificationService";
import { syncHolidaysForYear } from "./services/holidayService";
import { resolveTicker } from "./data/idx_companies";

// Helper to determine default stock based on 3-tier user priority
function determineDefaultTicker(data, currentPortfolio, currentFavorites) {
  if (!data || data.length === 0) return "BBCA.JK";

  // Priority 1: Latest stock the user bought
  const boughtTickers = Object.keys(currentPortfolio || {});
  if (boughtTickers.length > 0) {
    const sortedBought = boughtTickers.sort((a, b) => {
      const timeA = currentPortfolio[a]?.updatedAt || new Date(currentPortfolio[a]?.buyDate || 0).getTime();
      const timeB = currentPortfolio[b]?.updatedAt || new Date(currentPortfolio[b]?.buyDate || 0).getTime();
      return timeB - timeA;
    });
    const latestBought = sortedBought.find((t) => data.some((d) => d.ticker === t));
    if (latestBought) return latestBought;
  }

  // Priority 2: Latest added favorite stock
  if (Array.isArray(currentFavorites) && currentFavorites.length > 0) {
    const latestFav = currentFavorites.find((t) => data.some((d) => d.ticker === t));
    if (latestFav) return latestFav;
  }

  // Priority 3: The most hottest stock (highest expected return * model confidence)
  const sortedByHeat = [...data].sort((a, b) => {
    const heatA = (a.expected_return_pct || 0) * ((a.confidence || 50) / 100);
    const heatB = (b.expected_return_pct || 0) * ((b.confidence || 50) / 100);
    return heatB - heatA;
  });

  return sortedByHeat[0]?.ticker || data[0].ticker;
}

export default function App() {
  const [predictions, setPredictions] = useState(() => {
    try {
      const cached = localStorage.getItem("chartsoff_cached_predictions");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("chartsoff_cached_predictions");
      return !cached;
    } catch (e) {
      return true;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const [activeTab, setActiveTab] = useState("signals");
  const [errorMessage, setErrorMessage] = useState("");
  const isInitialLoadRef = useRef(true);

  // Portfolio State (Personal Broker bought stocks)
  const [portfolio, setPortfolio] = useState(() => {
    try {
      const saved = localStorage.getItem("chartsoff_portfolio");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // User favorites (Starred stocks)
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("chartsoff_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Portfolio Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState("BBCA.JK");

  // How It Works Modal State
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [howItWorksChapter, setHowItWorksChapter] = useState(null);

  const handleOpenHowItWorks = (chapter = null) => {
    setHowItWorksChapter(chapter);
    setIsHowItWorksOpen(true);
  };

  // Notification Center State
  const [notifications, setNotifications] = useState(() => NotificationService.getHistory());
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Request notification permissions and initialize background/foreground lifecycle + Dynamic Holiday Sync
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    syncHolidaysForYear(currentYear);
    syncHolidaysForYear(currentYear + 1);

    window.__onChartsOffStockSelect = (ticker) => {
      if (ticker) {
        handleSelectStock(ticker, true);
      }
    };

    NotificationService.requestPermission((ticker) => {
      if (ticker) {
        handleSelectStock(ticker, true);
      }
    });

    NotificationService.initLifecycle(
      // On Foreground (user opens/resumes app): sync predictions
      () => {
        fetchPredictions();
      },
      // On Background (user minimizes / switches app): evaluate notifications
      () => {
        if (predictions.length > 0) {
          NotificationService.evaluateAndSendNotifications(predictions, portfolio, favorites);
        }
      }
    );

    return () => {
      delete window.__onChartsOffStockSelect;
    };
  }, [predictions, portfolio, favorites]);

  // Universal stock selector that always resets view scroll to the very top
  const handleSelectStock = (ticker, switchTab = true) => {
    if (!ticker) return;
    setSelectedTicker(ticker);
    if (switchTab) {
      setActiveTab("signals");
    }
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (e) {
      window.scrollTo(0, 0);
    }
  };

  // Always guarantee page starts at the very top when activeTab or selectedTicker changes
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }, [selectedTicker, activeTab]);

  // Real-time evaluation of notifications when predictions/portfolio/favorites update
  useEffect(() => {
    if (predictions.length > 0) {
      NotificationService.evaluateAndSendNotifications(predictions, portfolio, favorites).then(() => {
        setNotifications(NotificationService.getHistory());
      });
    }
  }, [predictions, portfolio, favorites]);

  const handleClearAllNotifications = () => {
    NotificationService.clearHistory();
    setNotifications([]);
  };

  const handleMarkAllNotificationsAsRead = () => {
    const updated = NotificationService.markAllAsRead();
    setNotifications(updated);
  };

  const savePortfolioHolding = (ticker, holdingData) => {
    const holdingWithTimestamp = {
      ...holdingData,
      updatedAt: Date.now(),
    };

    setPortfolio((prev) => {
      const updated = { ...prev, [ticker]: holdingWithTimestamp };
      try {
        localStorage.setItem("chartsoff_portfolio", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Rule: Automatically add bought stock to favorites if not already present
    setFavorites((prev) => {
      if (!prev.includes(ticker)) {
        const updated = [ticker, ...prev];
        try {
          localStorage.setItem("chartsoff_favorites", JSON.stringify(updated));
        } catch (e) {}
        return updated;
      }
      return prev;
    });

    setSelectedTicker(ticker);
  };

  const deletePortfolioHolding = (ticker) => {
    setPortfolio((prev) => {
      const updated = { ...prev };
      delete updated[ticker];
      try {
        localStorage.setItem("chartsoff_portfolio", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const toggleFavorite = (ticker) => {
    setFavorites((prev) => {
      let updated;
      if (prev.includes(ticker)) {
        updated = prev.filter((t) => t !== ticker);
      } else {
        updated = [ticker, ...prev];
      }
      try {
        localStorage.setItem("chartsoff_favorites", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const fetchPredictions = async () => {
    setIsRefreshing(true);
    try {
      let data = null;

      // Tier 1: Try Local Development Proxy API (if running locally with FastAPI)
      try {
        const apiRes = await fetch("/api/predictions");
        if (apiRes.ok) data = await apiRes.json();
      } catch (e) {}

      if (!data || data.length === 0) {
        try {
          const host = window.location.hostname || "localhost";
          if (host === "localhost" || host === "127.0.0.1") {
            const directRes = await fetch(`http://${host}:8000/api/predictions`);
            if (directRes.ok) data = await directRes.json();
          }
        } catch (e) {}
      }

      // Tier 2: Remote GitHub Raw Cloud Sync (Guarantees automatic updates for installed APKs)
      if (!data || data.length === 0) {
        const cloudUrls = [
          `https://raw.githubusercontent.com/stockfishZ/ChartsOff/main/outputs/latest_predictions.json?t=${Date.now()}`,
          `https://cdn.jsdelivr.net/gh/stockfishZ/ChartsOff@main/outputs/latest_predictions.json?t=${Date.now()}`
        ];
        for (const cloudUrl of cloudUrls) {
          try {
            const cloudRes = await fetch(cloudUrl);
            if (cloudRes.ok) {
              const cloudData = await cloudRes.json();
              if (Array.isArray(cloudData) && cloudData.length > 0) {
                data = cloudData;
                break;
              }
            }
          } catch (e) {}
        }
      }

      // Tier 3: Local APK Asset Bundle fallback (Offline mode)
      if (!data || data.length === 0) {
        try {
          const res = await fetch(`/data/latest_predictions.json?t=${Date.now()}`);
          if (res.ok) data = await res.json();
        } catch (e) {}
      }

      if (Array.isArray(data) && data.length > 0) {
        setPredictions(data);
        try {
          localStorage.setItem("chartsoff_cached_predictions", JSON.stringify(data));
          localStorage.setItem("chartsoff_last_sync", new Date().toISOString());
        } catch (e) {}

        // Apply Priority on initial open / fresh refresh
        if (isInitialLoadRef.current) {
          const defaultTicker = determineDefaultTicker(data, portfolio, favorites);
          setSelectedTicker(defaultTicker);
          isInitialLoadRef.current = false;
        } else if (!data.some((d) => d.ticker === selectedTicker)) {
          const fallback = determineDefaultTicker(data, portfolio, favorites);
          setSelectedTicker(fallback);
        }
      }
    } catch (err) {
      console.error("Error memuat JSON prediksi:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
    // Recurring cloud auto-sync every 60 seconds (1 minute) while the app is active
    const interval = setInterval(() => {
      fetchPredictions();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check and update live price immediately every time a stock is selected
  useEffect(() => {
    if (selectedTicker) {
      const clean = selectedTicker.replace(".JK", "");
      const host = window.location.hostname || "localhost";
      const quoteUrls = [`/api/quote/${clean}`, `http://${host}:8000/api/quote/${clean}`];

      (async () => {
        for (const url of quoteUrls) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const quote = await res.json();
              if (quote && quote.current_price) {
                setPredictions((prev) =>
                  prev.map((p) =>
                    p.ticker === selectedTicker
                      ? { ...p, current_price: quote.current_price }
                      : p
                  )
                );
                break;
              }
            }
          } catch (e) {}
        }
      })();
    }
  }, [selectedTicker]);

  const handleAddCustomTicker = async (queryOrTicker) => {
    const clean = resolveTicker(queryOrTicker).toUpperCase().trim();
    const fullTicker = clean.endsWith(".JK") ? clean : `${clean}.JK`;
    setErrorMessage("");

    const existing = predictions.find((p) => p.ticker === fullTicker);
    if (existing) {
      setSelectedTicker(fullTicker);
      setActiveTab("signals");
      return;
    }

    setIsAddingTicker(true);
    try {
      let res = null;
      try {
        res = await fetch(`/api/predict/${clean}`);
      } catch (e) {}

      if (!res || !res.ok) {
        const host = window.location.hostname || "localhost";
        res = await fetch(`http://${host}:8000/api/predict/${clean}`);
      }

      if (!res || !res.ok) {
        const err = res ? await res.json() : {};
        throw new Error(err.detail || "Gagal menganalisis saham");
      }

      const newPred = await res.json();
      setPredictions((prev) => [newPred, ...prev.filter((p) => p.ticker !== newPred.ticker)]);
      handleSelectStock(newPred.ticker, true);
    } catch (err) {
      console.error(err);
      setErrorMessage(`Saham [${clean}] tidak ditemukan di BEI atau terjadi gangguan koneksi data.`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsAddingTicker(false);
    }
  };

  // Tiered Sorting Hierarchy:
  // Tier 1: Bought Stocks in Portfolio (Very Leftmost / First Index)
  // Tier 2: Starred / Favorite Stocks (Not in Portfolio)
  // Tier 3: General Stock Universe
  const sortedPredictions = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    
    const boughtTickers = Object.keys(portfolio).sort((a, b) => {
      const timeA = portfolio[a]?.updatedAt || new Date(portfolio[a]?.buyDate || 0).getTime();
      const timeB = portfolio[b]?.updatedAt || new Date(portfolio[b]?.buyDate || 0).getTime();
      return timeB - timeA;
    });

    const boughtSet = new Set(boughtTickers);
    const favSet = new Set(favorites);

    const tier1Bought = [];
    const tier2Favorites = [];
    const tier3General = [];

    // Add Tier 1 (Bought Stocks)
    boughtTickers.forEach((t) => {
      const found = predictions.find((p) => p.ticker === t);
      if (found) tier1Bought.push(found);
    });

    // Add Tier 2 (Favorites that are not bought)
    favorites.forEach((t) => {
      if (!boughtSet.has(t)) {
        const found = predictions.find((p) => p.ticker === t);
        if (found) tier2Favorites.push(found);
      }
    });

    // Add Tier 3 (Remaining General Stocks)
    predictions.forEach((p) => {
      if (!boughtSet.has(p.ticker) && !favSet.has(p.ticker)) {
        tier3General.push(p);
      }
    });

    return [...tier1Bought, ...tier2Favorites, ...tier3General];
  }, [predictions, portfolio, favorites]);

  const activePrediction =
    predictions.find((p) => p.ticker === selectedTicker) ||
    sortedPredictions[0] ||
    predictions[0];

  const activeHolding = activePrediction ? portfolio[activePrediction.ticker] : null;

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#121316] flex flex-col justify-between selection:bg-[#E5E3DC]">
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

        <main className="max-w-2xl mx-auto px-3 py-3">
          {loading ? (
            <div className="text-center py-20 font-mono text-xs text-[#737168]">
              Memuat Data Saham & Sentimen Bibit (BEI)...
            </div>
          ) : activeTab === "signals" ? (
            <div>
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
          ) : (
            <div className="bg-white border border-[#121316] p-3 sm:p-4 mb-8">
              {/* Header List Saham */}
              <div className="flex items-center justify-between border-b border-[#E5E3DC] pb-2.5 mb-3">
                <div>
                  <span className="font-mono text-xs font-bold uppercase text-[#121316] block">
                    Daftar Saham Aktif ({predictions.length})
                  </span>
                  <span className="text-[10px] text-[#737168] font-mono">Bursa Efek Indonesia (IDX)</span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] font-mono text-[#737168]">
                  <span className="flex items-center">
                    <HoldingIcon className="w-3 h-3 mr-1" color="#1B5E20" /> Portofolio
                  </span>
                  <span className="flex items-center">
                    <Star className="w-3 h-3 text-[#D97706] fill-[#D97706] mr-1" /> Favorit
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
                      className="py-2.5 px-1 flex items-center justify-between hover:bg-[#FAF9F6] active:bg-[#F1EFEA] transition cursor-pointer"
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
                            className="p-1.5 hover:bg-[#E8F5E9] rounded shrink-0"
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
                            className="p-1.5 hover:bg-[#E5E3DC] rounded shrink-0"
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
                              <span className="text-[8px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1 py-0.2 border border-[#1B5E20]/30 uppercase">
                                Dimiliki
                              </span>
                            )}
                            {item.action_alert?.type === "PRIME_BUY" && (
                              <span className="text-[8px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1 py-0.2 border border-[#1B5E20] uppercase flex items-center" title="Prospek Bagus: Konfluensi momentum dan sentimen positif terkonfirmasi">
                                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-[#1B5E20]" />
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
                            className={`px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase border ${
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
                                <span className="text-[8px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1 py-0.2 border border-[#1B5E20]/30 uppercase">
                                  Dimiliki
                                </span>
                              )}
                              {item.action_alert?.type === "PRIME_BUY" && (
                                <span className="text-[8px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1 py-0.2 border border-[#1B5E20] uppercase flex items-center" title="Prospek Bagus: Konfluensi momentum dan sentimen positif terkonfirmasi">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5 text-[#1B5E20]" />
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
          )}
        </main>
      </div>

      {/* Main Page Footer */}
      <footer className="py-4 border-t border-[#E5E3DC] text-center bg-[#FAF9F6] mt-6">
        <span className="text-[11px] font-mono text-[#737168]">
          © StockfishZ
        </span>
      </footer>

      {/* Portfolio Modal Dialog */}
      <PortfolioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ticker={modalTicker}
        currentPrice={predictions.find((p) => p.ticker === modalTicker)?.current_price || 0}
        existingHolding={portfolio[modalTicker]}
        onSave={savePortfolioHolding}
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
