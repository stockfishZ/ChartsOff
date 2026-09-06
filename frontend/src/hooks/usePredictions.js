import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { resolveTicker } from "../data/idx_companies";

// Helper to determine default stock based on 3-tier user priority
export function determineDefaultTicker(data, currentPortfolio, currentFavorites) {
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

  // Priority 3: The hottest stock (highest expected return * model confidence)
  const sortedByHeat = [...data].sort((a, b) => {
    const heatA = (a.expected_return_pct || 0) * ((a.confidence || 50) / 100);
    const heatB = (b.expected_return_pct || 0) * ((b.confidence || 50) / 100);
    return heatB - heatA;
  });

  return sortedByHeat[0]?.ticker || data[0].ticker;
}

export function usePredictions({
  portfolio = {},
  favorites = [],
  onSelectStock,
} = {}) {
  const [predictions, setPredictions] = useState(() => {
    try {
      const cached = localStorage.getItem("chartsoff_cached_predictions");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [selectedTicker, setSelectedTicker] = useState("BBCA.JK");
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("chartsoff_cached_predictions");
      return !cached;
    } catch {
      return true;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isInitialLoadRef = useRef(true);

  // References to avoid stale closures in recurring fetch callbacks
  const portfolioRef = useRef(portfolio);
  const favoritesRef = useRef(favorites);
  useEffect(() => {
    portfolioRef.current = portfolio;
    favoritesRef.current = favorites;
  }, [portfolio, favorites]);

  const fetchPredictions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let data = null;

      // Tier 1: Try Local Development Proxy API (if running locally with FastAPI)
      try {
        const apiRes = await fetch("/api/predictions");
        if (apiRes.ok) data = await apiRes.json();
      } catch {}

      if (!data || data.length === 0) {
        try {
          const host = window.location.hostname || "localhost";
          if (host === "localhost" || host === "127.0.0.1") {
            const directRes = await fetch(`http://${host}:8000/api/predictions`);
            if (directRes.ok) data = await directRes.json();
          }
        } catch {}
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
          } catch {}
        }
      }

      // Tier 3: Local APK Asset Bundle fallback (Offline mode)
      if (!data || data.length === 0) {
        try {
          const res = await fetch(`/data/latest_predictions.json?t=${Date.now()}`);
          if (res.ok) data = await res.json();
        } catch {}
      }

      if (Array.isArray(data) && data.length > 0) {
        setPredictions(data);
        try {
          localStorage.setItem("chartsoff_cached_predictions", JSON.stringify(data));
          localStorage.setItem("chartsoff_last_sync", new Date().toISOString());
        } catch {}

        // Apply Priority on initial open / fresh refresh
        if (isInitialLoadRef.current) {
          const defaultTicker = determineDefaultTicker(data, portfolioRef.current, favoritesRef.current);
          setSelectedTicker(defaultTicker);
          isInitialLoadRef.current = false;
        } else if (!data.some((d) => d.ticker === selectedTicker)) {
          const fallback = determineDefaultTicker(data, portfolioRef.current, favoritesRef.current);
          setSelectedTicker(fallback);
        }
      }
    } catch (err) {
      console.error("Error memuat JSON prediksi:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTicker]);

  // Background auto-sync polling every 30 minutes (30 * 60 * 1000 ms)
  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(() => {
      fetchPredictions();
    }, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, [fetchPredictions]);

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
          } catch {}
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
      if (onSelectStock) onSelectStock(fullTicker);
      return;
    }

    setIsAddingTicker(true);
    try {
      let res = null;
      try {
        res = await fetch(`/api/predict/${clean}`);
      } catch {}

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
      if (onSelectStock) onSelectStock(newPred.ticker);
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

    const boughtTickers = Object.keys(portfolio || {}).sort((a, b) => {
      const timeA = portfolio[a]?.updatedAt || new Date(portfolio[a]?.buyDate || 0).getTime();
      const timeB = portfolio[b]?.updatedAt || new Date(portfolio[b]?.buyDate || 0).getTime();
      return timeB - timeA;
    });

    const boughtSet = new Set(boughtTickers);
    const favSet = new Set(favorites || []);

    const tier1Bought = [];
    const tier2Favorites = [];
    const tier3General = [];

    // Add Tier 1 (Bought Stocks)
    boughtTickers.forEach((t) => {
      const found = predictions.find((p) => p.ticker === t);
      if (found) tier1Bought.push(found);
    });

    // Add Tier 2 (Favorites that are not bought)
    (favorites || []).forEach((t) => {
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

  return {
    predictions,
    setPredictions,
    selectedTicker,
    setSelectedTicker,
    loading,
    isRefreshing,
    isAddingTicker,
    errorMessage,
    setErrorMessage,
    fetchPredictions,
    handleAddCustomTicker,
    sortedPredictions,
  };
}

export default usePredictions;
