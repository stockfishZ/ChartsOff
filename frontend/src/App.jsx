import React, { useState, useEffect, useMemo, useRef } from "react";
import { Star } from "lucide-react";
import HoldingIcon from "./components/HoldingIcon";
import Header from "./components/Header";
import TickerList, { formatRupiah } from "./components/TickerList";
import PredictionCard from "./components/PredictionCard";
import StockChart from "./components/StockChart";
import KeyFactors from "./components/KeyFactors";
import NewsFeed from "./components/NewsFeed";
import PortfolioModal from "./components/PortfolioModal";
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
  const [predictions, setPredictions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");
  const [loading, setLoading] = useState(true);
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
      try {
        const apiRes = await fetch("/api/predictions");
        if (apiRes.ok) data = await apiRes.json();
      } catch (e) {}

      if (!data || data.length === 0) {
        try {
          const host = window.location.hostname || "localhost";
          const directRes = await fetch(`http://${host}:8000/api/predictions`);
          if (directRes.ok) data = await directRes.json();
        } catch (e) {}
      }

      if (!data || data.length === 0) {
        const res = await fetch(`/data/latest_predictions.json?t=${Date.now()}`);
        if (res.ok) data = await res.json();
      }

      if (Array.isArray(data) && data.length > 0) {
        setPredictions(data);

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
  }, []);

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
      setSelectedTicker(newPred.ticker);
      setActiveTab("signals");
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
                onSelectTicker={setSelectedTicker}
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
                  <KeyFactors factors={activePrediction.key_factors} />
                  <NewsFeed newsSentiment={activePrediction.news_sentiment} />
                </>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#121316] p-4 mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold uppercase text-[#121316]">
                  Daftar Saham Aktif ({predictions.length})
                </span>
                <span className="text-[10px] text-[#737168] font-mono">Bursa Efek Indonesia</span>
              </div>

              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-[#121316] text-[10px] uppercase text-[#737168]">
                    <th className="py-2 w-7">Status</th>
                    <th className="py-2">Kode</th>
                    <th className="py-2">Harga</th>
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

                    return (
                      <tr
                        key={item.ticker}
                        className="hover:bg-[#FAF9F6] transition"
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
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("signals");
                          }}
                          className="py-2.5 font-bold font-editorial cursor-pointer"
                        >
                          <div className="flex items-center space-x-1.5">
                            <span>{cleanTicker}</span>
                            {isBought && (
                              <span className="text-[8px] font-mono font-bold text-[#1B5E20] bg-[#E8F5E9] px-1 py-0.2 border border-[#1B5E20]/30 uppercase">
                                Dimiliki
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("signals");
                          }}
                          className="py-2.5 font-mono-num cursor-pointer"
                        >
                          {formatRupiah(item.current_price)}
                        </td>
                        <td
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("signals");
                          }}
                          className="py-2.5 cursor-pointer"
                        >
                          <span
                            className={`px-1 py-0.5 text-[10px] font-mono font-bold uppercase ${
                              isBull ? "text-[#1B5E20]" : isBear ? "text-[#B71C1C]" : "text-[#5D4037]"
                            }`}
                          >
                            {item.signal}
                          </span>
                        </td>
                        <td
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("signals");
                          }}
                          className="py-2.5 font-mono-num text-right cursor-pointer"
                        >
                          {item.confidence}%
                        </td>
                        <td
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("signals");
                          }}
                          className={`py-2.5 font-mono-num font-bold text-right cursor-pointer ${
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
          )}
        </main>
      </div>

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
    </div>
  );
}
