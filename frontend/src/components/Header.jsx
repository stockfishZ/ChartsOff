import React, { useState, useMemo, useRef, useEffect } from "react";
import { RefreshCw, Search, X, Info, Bell } from "lucide-react";
import { IDX_COMPANIES, resolveTicker } from "../data/idx_companies";
import { getHolidayInfo } from "../services/holidayService";

/**
 * Calculates current market session status for the Indonesia Stock Exchange (IDX / BEI)
 * Trading hours based on Western Indonesian Time (WIB / UTC+7)
 */
export function getIdxMarketStatus() {
  const now = new Date();
  // Compute current time in WIB (UTC+7)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);

  const day = wibDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const hours = wibDate.getHours();
  const minutes = wibDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Check Official BEI / National Holidays (Live Dynamic Feed + Cache)
  const yyyy = wibDate.getFullYear();
  const mm = String(wibDate.getMonth() + 1).padStart(2, "0");
  const dd = String(wibDate.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // 1. Dynamic Live/Cached Holiday Lookup (Auto-refreshed from SKB 3 Menteri & Global ISO feeds)
  const dynamicHoliday = getHolidayInfo(dateStr);
  if (dynamicHoliday) {
    return {
      isOpen: false,
      status: "HOLIDAY",
      label: "BEI Libur",
      sublabel: dynamicHoliday,
      color: "gray",
    };
  }

  // 2. Fixed Annual National Holidays Fallback
  const FIXED_ANNUAL_HOLIDAYS = {
    "01-01": "Tahun Baru Masehi",
    "05-01": "Hari Buruh Internasional",
    "06-01": "Hari Lahir Pancasila",
    "08-17": "Hari Kemerdekaan RI",
    "12-25": "Hari Raya Natal",
  };
  const monthDay = `${mm}-${dd}`;
  if (FIXED_ANNUAL_HOLIDAYS[monthDay]) {
    return {
      isOpen: false,
      status: "HOLIDAY",
      label: "BEI Libur",
      sublabel: FIXED_ANNUAL_HOLIDAYS[monthDay],
      color: "gray",
    };
  }

  // Weekend: Saturday or Sunday
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      status: "CLOSED",
      label: "BEI Tutup",
      sublabel: "Buka Senin 09:00 WIB",
      color: "gray",
    };
  }

  // Friday Trading Hours
  if (day === 5) {
    if (timeInMinutes >= 525 && timeInMinutes < 540) {
      return {
        isOpen: true,
        status: "PRE_OPEN",
        label: "BEI Pra-Buka",
        sublabel: "Sesi 1 09:00 WIB",
        color: "blue",
      };
    }
    if (timeInMinutes >= 540 && timeInMinutes < 690) {
      return {
        isOpen: true,
        status: "SESSION_1",
        label: "BEI Buka (Sesi 1)",
        sublabel: "Istirahat 11:30 WIB",
        color: "green",
      };
    }
    if (timeInMinutes >= 690 && timeInMinutes < 840) {
      return {
        isOpen: false,
        status: "BREAK",
        label: "BEI Istirahat",
        sublabel: "Sesi 2 14:00 WIB",
        color: "amber",
      };
    }
    if (timeInMinutes >= 840 && timeInMinutes < 950) {
      return {
        isOpen: true,
        status: "SESSION_2",
        label: "BEI Buka (Sesi 2)",
        sublabel: "Tutup 15:50 WIB",
        color: "green",
      };
    }
    if (timeInMinutes >= 950 && timeInMinutes < 975) {
      return {
        isOpen: true,
        status: "PRE_CLOSE",
        label: "BEI Pra-Tutup",
        sublabel: "Selesai 16:15 WIB",
        color: "blue",
      };
    }
    return {
      isOpen: false,
      status: "CLOSED",
      label: "BEI Tutup",
      sublabel: "Buka Senin 09:00 WIB",
      color: "gray",
    };
  }

  // Monday - Thursday Trading Hours
  if (timeInMinutes >= 525 && timeInMinutes < 540) {
    return {
      isOpen: true,
      status: "PRE_OPEN",
      label: "BEI Pra-Buka",
      sublabel: "Sesi 1 09:00 WIB",
      color: "blue",
    };
  }
  if (timeInMinutes >= 540 && timeInMinutes < 720) {
    return {
      isOpen: true,
      status: "SESSION_1",
      label: "BEI Buka (Sesi 1)",
      sublabel: "Istirahat 12:00 WIB",
      color: "green",
    };
  }
  if (timeInMinutes >= 720 && timeInMinutes < 810) {
    return {
      isOpen: false,
      status: "BREAK",
      label: "BEI Istirahat",
      sublabel: "Sesi 2 13:30 WIB",
      color: "amber",
    };
  }
  if (timeInMinutes >= 810 && timeInMinutes < 950) {
    return {
      isOpen: true,
      status: "SESSION_2",
      label: "BEI Buka (Sesi 2)",
      sublabel: "Tutup 15:50 WIB",
      color: "green",
    };
  }
  if (timeInMinutes >= 950 && timeInMinutes < 975) {
    return {
      isOpen: true,
      status: "PRE_CLOSE",
      label: "BEI Pra-Tutup",
      sublabel: "Selesai 16:15 WIB",
      color: "blue",
    };
  }

  // Mon-Thu Closed
  return {
    isOpen: false,
    status: "CLOSED",
    label: "BEI Tutup",
    sublabel: timeInMinutes < 525 ? "Buka Hari Ini 09:00 WIB" : "Buka Besok 09:00 WIB",
    color: "gray",
  };
}

export default function Header({
  onRefresh,
  isRefreshing,
  onAddCustomTicker,
  isAddingTicker,
  activeTab,
  setActiveTab,
  onOpenHowItWorks,
  unreadNotifCount = 0,
  onOpenNotifications,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [marketStatus, setMarketStatus] = useState(() => getIdxMarketStatus());
  const searchRef = useRef(null);

  // Update market status every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getIdxMarketStatus());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

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
    <header className="bg-white border-b border-[#121316] px-4 pt-2.5 pb-0 relative z-30" ref={searchRef}>
      <div className="max-w-2xl mx-auto">
        {/* Top Row: Brand + How It Works + Notifications + Search & Refresh */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center">
            <span className="font-editorial font-bold text-xl tracking-tight text-[#121316]">CHARTSOFF</span>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Quick Runthrough "How CHARTSOFF Works" Button */}
            <button
              type="button"
              onClick={onOpenHowItWorks}
              className="px-2.5 py-1.5 border border-[#121316] bg-[#FAF9F6] hover:bg-[#121316] hover:text-white text-[#121316] transition active:scale-95 text-xs flex items-center space-x-1.5 cursor-pointer shadow-2xs group"
              title="Dokumentasi Cara Kerja CHARTSOFF & Panduan Indikator"
            >
              <Info className="w-3.5 h-3.5 text-[#121316] group-hover:text-white transition shrink-0" />
              <span className="text-[11px] font-sans font-medium">How CHARTSOFF Works</span>
            </button>

            {/* Notification Center Button */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-1.5 border border-[#121316] bg-[#FAF9F6] hover:bg-[#121316] hover:text-white text-[#121316] transition active:scale-95 text-xs flex items-center relative cursor-pointer group"
              title="Notifikasi"
            >
              <Bell className="w-3.5 h-3.5 text-[#121316] group-hover:text-white transition" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#B71C1C] text-white text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`px-2.5 py-1.5 border border-[#121316] transition active:scale-95 text-xs flex items-center space-x-1.5 cursor-pointer ${
                showSearch ? "bg-[#121316] text-white" : "bg-white hover:bg-[#F1EFEA] text-[#121316]"
              }`}
              title="Cari Saham / Emiten"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-[11px] font-sans font-medium hidden sm:inline">Cari Saham</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-[#F1EFEA] border border-[#121316] text-[#121316] transition active:scale-95 text-xs flex items-center space-x-1 cursor-pointer"
              title="Sinkronisasi Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        {showSearch && (
          <div className="pt-2 pb-3 border-t border-[#E5E3DC]">
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

        {/* Header Navigation Tabs: "Forecast" and "List Saham" + Real-Time BEI Market Status Badge */}
        <div className="flex items-center justify-between border-t border-[#E5E3DC] -mx-4 px-4 bg-[#FAF9F6]">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab("signals")}
              className={`py-2 px-4 text-xs font-sans font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === "signals"
                  ? "border-[#121316] text-[#121316] bg-white"
                  : "border-transparent text-[#737168] hover:text-[#121316] hover:bg-[#F1EFEA]"
              }`}
            >
              Forecast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("watchlist")}
              className={`py-2 px-4 text-xs font-sans font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === "watchlist"
                  ? "border-[#121316] text-[#121316] bg-white"
                  : "border-transparent text-[#737168] hover:text-[#121316] hover:bg-[#F1EFEA]"
              }`}
            >
              List Saham
            </button>
          </div>

          {/* Real-Time BEI / IDX Market Status Indicator */}
          <div
            className="flex items-center space-x-1.5 px-2 py-1 bg-white border border-[#E5E3DC] text-[10px] font-mono select-none"
            title={`Status Pasar Bursa Efek Indonesia: ${marketStatus.label} (${marketStatus.sublabel})`}
          >
            <span className="relative flex h-2 w-2">
              {marketStatus.isOpen && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1B5E20] opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  marketStatus.color === "green"
                    ? "bg-[#1B5E20]"
                    : marketStatus.color === "amber"
                    ? "bg-[#D97706]"
                    : marketStatus.color === "blue"
                    ? "bg-[#1565C0]"
                    : "bg-[#737168]"
                }`}
              ></span>
            </span>
            <span className="font-bold text-[#121316]">{marketStatus.label}</span>
            <span className="text-[#737168] hidden sm:inline">• {marketStatus.sublabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
