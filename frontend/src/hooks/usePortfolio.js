import { useState } from "react";

const STORAGE_KEY = "chartsoff_portfolio";

export function usePortfolio({ onHoldingAdded } = {}) {
  const [portfolio, setPortfolio] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const savePortfolioHolding = (ticker, holdingData) => {
    const holdingWithTimestamp = {
      ...holdingData,
      updatedAt: Date.now(),
    };

    setPortfolio((prev) => {
      const updated = { ...prev, [ticker]: holdingWithTimestamp };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Notify callback (e.g., to auto-favorite bought stock)
    if (onHoldingAdded) {
      onHoldingAdded(ticker);
    }
  };

  const deletePortfolioHolding = (ticker) => {
    setPortfolio((prev) => {
      const updated = { ...prev };
      delete updated[ticker];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  return {
    portfolio,
    setPortfolio,
    savePortfolioHolding,
    deletePortfolioHolding,
  };
}

export default usePortfolio;
