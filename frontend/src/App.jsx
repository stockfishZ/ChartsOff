import React, { useState, useEffect, useMemo } from "react";
import { Star } from "lucide-react";
import Header from "./components/Header";
import TickerList, { formatRupiah } from "./components/TickerList";
import PredictionCard from "./components/PredictionCard";
import StockChart from "./components/StockChart";
import KeyFactors from "./components/KeyFactors";
import NewsFeed from "./components/NewsFeed";
import BottomNav from "./components/BottomNav";
import { resolveTicker } from "./data/idx_companies";

export default function App() {
  const [predictions, setPredictions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const [activeTab, setActiveTab] = useState("signals");
  const [errorMessage, setErrorMessage] = useState("");

  // Load user favorites from localStorage
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("chartsoff_favorites");
      return saved ? JSON.parse(saved) : ["BBCA.JK", "BBRI.JK"];
    } catch (e) {
      return ["BBCA.JK", "BBRI.JK"];
    }
  });

  const toggleFavorite = (ticker) => {
    setFavorites((prev) => {
      let updated;
      if (prev.includes(ticker)) {
        updated = prev.filter((t) => t !== ticker);
      } else {
        updated = [ticker, ...prev]; // Put new favorite at the very top
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
        if (!data.some((d) => d.ticker === selectedTicker)) {
          setSelectedTicker(data[0].ticker);
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

  // Sort list: Pinned favorites are placed on the VERY LEFT (first indices)
  const sortedPredictions = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    const favSet = new Set(favorites);
    const favItems = [];
    const regularItems = [];

    // Maintain the order of favorites
    favorites.forEach((favTicker) => {
      const found = predictions.find((p) => p.ticker === favTicker);
      if (found) favItems.push(found);
    });

    predictions.forEach((p) => {
      if (!favSet.has(p.ticker)) {
        regularItems.push(p);
      }
    });

    return [...favItems, ...regularItems];
  }, [predictions, favorites]);

  const activePrediction = predictions.find((p) => p.ticker === selectedTicker) || sortedPredictions[0] || predictions[0];

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#121316] flex flex-col justify-between selection:bg-[#E5E3DC]">
      <div>
        <Header
          onRefresh={fetchPredictions}
          isRefreshing={isRefreshing}
          onAddCustomTicker={handleAddCustomTicker}
          isAddingTicker={isAddingTicker}
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
                onToggleFavorite={toggleFavorite}
              />
              {activePrediction && (
                <>
                  <PredictionCard
                    prediction={activePrediction}
                    isFavorite={favorites.includes(activePrediction.ticker)}
                    onToggleFavorite={toggleFavorite}
                  />
                  <StockChart prediction={activePrediction} />
                  <KeyFactors factors={activePrediction.key_factors} />
                  <NewsFeed newsSentiment={activePrediction.news_sentiment} />
                </>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#121316] p-4 mb-20">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold uppercase text-[#121316]">
                  Daftar Saham Aktif ({predictions.length})
                </span>
                <span className="text-[10px] text-[#737168] font-mono">Bursa Efek Indonesia</span>
              </div>

              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-[#121316] text-[10px] uppercase text-[#737168]">
                    <th className="py-2 w-6">Pin</th>
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
                    const isFav = favorites.includes(item.ticker);
                    const cleanTicker = item.ticker.replace(".JK", "");

                    return (
                      <tr
                        key={item.ticker}
                        className="hover:bg-[#FAF9F6] transition"
                      >
                        <td className="py-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item.ticker);
                            }}
                            className="p-1 hover:bg-[#E5E3DC] rounded"
                            title={isFav ? "Hapus Pin" : "Pin ke Paling Depan"}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isFav ? "text-[#D97706] fill-[#D97706]" : "text-[#DCDAD4]"
                              }`}
                            />
                          </button>
                        </td>
                        <td
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("signals");
                          }}
                          className="py-2.5 font-bold font-editorial cursor-pointer"
                        >
                          {cleanTicker}
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

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
