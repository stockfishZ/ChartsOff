import { useState } from "react";

const STORAGE_KEY = "chartsoff_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (ticker) => {
    setFavorites((prev) => {
      let updated;
      if (prev.includes(ticker)) {
        updated = prev.filter((t) => t !== ticker);
      } else {
        updated = [ticker, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addFavorite = (ticker) => {
    setFavorites((prev) => {
      if (!prev.includes(ticker)) {
        const updated = [ticker, ...prev];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
  };

  return {
    favorites,
    setFavorites,
    toggleFavorite,
    addFavorite,
  };
}

export default useFavorites;
