import React, { useState, useMemo, useRef, useEffect } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { IDX_COMPANIES, resolveTicker } from "../data/idx_companies";

export default function Header({
  onRefresh,
  isRefreshing,
  onAddCustomTicker,
  isAddingTicker,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);

  const searchResults = useMemo(() => {
    if (!searchInput.trim()) return [];
    const q = searchInput.toLowerCase().trim();
    return IDX_COMPANIES.filter(
      (c) =>
        c.ticker.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        (c.aliases && c.aliases.some((a) => a.includes(q)))
    ).slice(0, 8);
  }, [searchInput]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCompany = (rawTickerOrName) => {
    const finalTicker = resolveTicker(rawTickerOrName);
    onAddCustomTicker(finalTicker);
    setSearchInput("");
    setShowSearch(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    handleSelectCompany(searchInput.trim());
  };

  return (
    <header className="bg-white border-b border-[#121316] px-4 py-2.5 relative z-30" ref={searchRef}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-editorial font-bold text-xl tracking-tight text-[#121316]">CHARTSOFF</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`px-2.5 py-1.5 border border-[#121316] transition active:scale-95 text-xs flex items-center space-x-1.5 ${
                showSearch ? "bg-[#121316] text-white" : "bg-white hover:bg-[#F1EFEA] text-[#121316]"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-[11px] font-sans font-medium">Cari Saham / Emiten</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-[#F1EFEA] border border-[#121316] text-[#121316] transition active:scale-95 text-xs flex items-center space-x-1"
              title="Sinkronisasi Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="mt-2.5 pt-2.5 border-t border-[#E5E3DC]">
            <form onSubmit={handleManualSubmit} className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#737168] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ketik nama (BCA, Telkom, Mandiri, Indofood) atau kode (BBCA, TLKM)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-[#121316] text-xs font-sans bg-[#FAF9F6] text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#121316]"
                autoFocus
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 text-[#737168] hover:text-[#121316]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Results Dropdown */}
            {searchInput.trim() && (
              <div className="mt-1 border border-[#121316] bg-white shadow-xl max-h-64 overflow-y-auto divide-y divide-[#E5E3DC]">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onClick={() => handleSelectCompany(item.ticker)}
                      disabled={isAddingTicker}
                      className="w-full px-3 py-2 text-left hover:bg-[#FAF9F6] transition flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-editorial font-bold text-sm text-[#121316] w-14">
                          {item.ticker}
                        </span>
                        <div>
                          <p className="text-xs font-sans text-[#121316] group-hover:underline">
                            {item.name}
                          </p>
                          <span className="text-[10px] font-mono text-[#737168]">{item.sector}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-serif italic text-[#737168] group-hover:text-[#121316]">
                        Analisis →
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center">
                    <p className="text-xs text-[#737168]">Kode tidak ada di daftar cepat.</p>
                    <button
                      type="button"
                      onClick={() => handleSelectCompany(searchInput.trim())}
                      className="mt-1 text-xs font-mono font-bold text-[#1B5E20] underline"
                    >
                      Analisis langsung kode "{searchInput.toUpperCase()}" di BEI →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
