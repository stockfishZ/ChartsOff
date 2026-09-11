import React, { useState, useMemo, useRef, useEffect } from "react";
import { RefreshCw, Search, X, Info, Bell, Briefcase, Cloud, HardDrive, WifiOff, CheckCircle2 } from "lucide-react";
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
    if (timeInMinutes >= 975 && timeInMinutes < 990) {
      return {
        isOpen: false,
        status: "CLOSED",
        label: "BEI Tutup",
        sublabel: "Update Pipeline 16:30 WIB",
        color: "gray",
      };
    }
    return {
      isOpen: false,
      status: "CLOSED",
      label: "BEI Tutup",
      sublabel: "Data Penutupan • Buka Senin 09:00 WIB",
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
  if (timeInMinutes >= 975 && timeInMinutes < 990) {
    return {
      isOpen: false,
      status: "CLOSED",
      label: "BEI Tutup",
      sublabel: "Update Pipeline 16:30 WIB",
      color: "gray",
    };
  }

  return {
    isOpen: false,
    status: "CLOSED",
    label: "BEI Tutup",
    sublabel: timeInMinutes < 525 ? "Buka Hari Ini 09:00 WIB" : "Data Penutupan • Buka Besok 09:00 WIB",
    color: "gray",
  };
}

/**
 * Formats a Date or timestamp string/number into Western Indonesian Time (WIB / UTC+7)
 * e.g., "11 Sep 2026, 16:30 WIB"
 */
export function formatWibDateTime(dateOrTimestamp, options = {}) {
  if (!dateOrTimestamp) return "-";
  const dateObj = new Date(dateOrTimestamp);
  if (isNaN(dateObj.getTime())) return "-";

  // Convert to WIB (UTC+7)
  const utc = dateObj.getTime() + dateObj.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const daysLong = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const daysShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const dayNameLong = daysLong[wibDate.getDay()];
  const dayNameShort = daysShort[wibDate.getDay()];
  const day = wibDate.getDate();
  const month = months[wibDate.getMonth()];
  const year = wibDate.getFullYear();
  const hours = String(wibDate.getHours()).padStart(2, "0");
  const mins = String(wibDate.getMinutes()).padStart(2, "0");

  if (options.dateOnly) {
    return `${day} ${month} ${year}`;
  }
  if (options.short) {
    return `${day} ${month}, ${hours}:${mins} WIB`;
  }
  if (options.includeDay) {
    return `${dayNameLong}, ${day} ${month} ${year}, ${hours}:${mins} WIB`;
  }
  if (options.shortWithDay) {
    return `${dayNameShort}, ${day} ${month} ${hours}:${mins} WIB`;
  }
  return `${day} ${month} ${year}, ${hours}:${mins} WIB`;
}

/**
 * Returns a human-friendly relative time string in Indonesian
 * e.g., "Baru saja", "5 mnt lalu", "1 jam lalu"
 */
export function formatRelativeTime(dateOrTimestamp) {
  if (!dateOrTimestamp) return "";
  const t = new Date(dateOrTimestamp).getTime();
  if (isNaN(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));

  if (diffSec < 45) return "Baru saja";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return `${Math.floor(diffSec / 86400)} hari lalu`;
}

/**
 * Formats current date in Western Indonesian Time (WIB / UTC+7)
 * e.g. "Minggu, 6 Sep 2026" (long) or "Min, 6 Sep 2026" (short)
 */
export function getWibDateFormatted() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);

  const daysLong = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const daysShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const dayIndex = wibDate.getDay();
  const date = wibDate.getDate();
  const month = months[wibDate.getMonth()];
  const year = wibDate.getFullYear();

  return {
    long: `${daysLong[dayIndex]}, ${date} ${month} ${year}`,
    short: `${daysShort[dayIndex]}, ${date} ${month} ${year}`,
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
  syncSource = "cloud",
  lastSyncTime = null,
  lastDataTimestamp = null,
  isOffline = false,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [marketStatus, setMarketStatus] = useState(() => getIdxMarketStatus());
  const [currentDate, setCurrentDate] = useState(() => getWibDateFormatted());
  const searchRef = useRef(null);

  // Update market status and WIB date every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getIdxMarketStatus());
      setCurrentDate(getWibDateFormatted());
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
    <header className="bg-white border-b border-[#121316] px-3.5 sm:px-4 pt-[calc(0.65rem+env(safe-area-inset-top,0px))] pb-0 relative z-30" ref={searchRef}>
      <div className="max-w-2xl mx-auto">
        {/* Top Row: Brand + How It Works + Notifications + Search & Refresh */}
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center min-w-0 pr-1">
            <span className="font-editorial font-bold text-xl sm:text-2xl tracking-tight text-[#121316] truncate">CHARTSOFF</span>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Quick Runthrough "How CHARTSOFF Works" Button */}
            <button
              type="button"
              onClick={onOpenHowItWorks}
              className="px-2.5 sm:px-3 py-2 border border-[#121316] bg-[#FAF9F6] hover:bg-[#121316] hover:text-white text-[#121316] transition active:scale-95 text-xs flex items-center space-x-1.5 cursor-pointer shadow-2xs group min-h-[38px]"
              title="Dokumentasi Cara Kerja CHARTSOFF & Panduan Indikator"
            >
              <Info className="w-3.5 h-3.5 text-[#121316] group-hover:text-white transition shrink-0" />
              <span className="text-[11px] font-sans font-medium hidden sm:inline">Panduan & Cara Kerja</span>
              <span className="text-[11px] font-sans font-medium sm:hidden">Panduan</span>
            </button>

            {/* Notification Center Button */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-2 border border-[#121316] bg-[#FAF9F6] hover:bg-[#121316] hover:text-white text-[#121316] transition active:scale-95 text-xs flex items-center justify-center relative cursor-pointer group min-h-[38px] min-w-[38px]"
              title="Notifikasi"
            >
              <Bell className="w-4 h-4 text-[#121316] group-hover:text-white transition" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#B71C1C] text-white text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Search Button */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`px-2.5 sm:px-3 py-2 border border-[#121316] transition active:scale-95 text-xs flex items-center space-x-1.5 cursor-pointer min-h-[38px] ${
                showSearch ? "bg-[#121316] text-white" : "bg-white hover:bg-[#F1EFEA] text-[#121316]"
              }`}
              title="Cari Saham / Emiten"
            >
              <Search className="w-4 h-4" />
              <span className="text-[11px] font-sans font-medium hidden sm:inline">Cari Saham</span>
            </button>

            {/* Refresh Sync Button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 hover:bg-[#F1EFEA] border border-[#121316] text-[#121316] transition active:scale-95 text-xs flex items-center justify-center cursor-pointer min-h-[38px] min-w-[38px]"
              title="Sinkronisasi Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
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

        {/* Header Navigation Tabs: "Forecast" and "List Saham" (Desktop) + Market Status & Data Freshness Badges */}
        <div className="flex items-center justify-between border-t border-[#E5E3DC] -mx-3.5 sm:-mx-4 px-3.5 sm:px-4 py-1.5 md:py-0 bg-[#FAF9F6]">
          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab("signals")}
              className={`py-2 px-3 sm:px-4 text-xs font-sans font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
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
              className={`py-2 px-3 sm:px-4 text-xs font-sans font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === "watchlist"
                  ? "border-[#121316] text-[#121316] bg-white"
                  : "border-transparent text-[#737168] hover:text-[#121316] hover:bg-[#F1EFEA]"
              }`}
            >
              List Saham
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("portfolio")}
              className={`py-2 px-3 sm:px-4 text-xs font-sans font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center space-x-1 ${
                activeTab === "portfolio"
                  ? "border-[#121316] text-[#121316] bg-white"
                  : "border-transparent text-[#737168] hover:text-[#121316] hover:bg-[#F1EFEA]"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Portofolio</span>
            </button>
          </div>

          {/* Badges Container: Responsive layout for both mobile & desktop */}
          <div className="flex items-center justify-between md:justify-end w-full md:w-auto space-x-1.5 sm:space-x-2 shrink-0">
            {/* Real-Time BEI / IDX Market Status Indicator */}
            <div
              className="flex items-center space-x-1.5 px-2 py-1 bg-white border border-[#E5E3DC] text-[10px] font-mono select-none shrink-0 max-w-[48%] sm:max-w-none"
              title={`Status Pasar Bursa Efek Indonesia: ${marketStatus.label} (${marketStatus.sublabel})`}
            >
              <span
                className={`inline-flex rounded-full h-2 w-2 shrink-0 ${
                  marketStatus.color === "green"
                    ? "bg-[#1B5E20]"
                    : marketStatus.color === "amber"
                    ? "bg-[#D97706]"
                    : marketStatus.color === "blue"
                    ? "bg-[#1565C0]"
                    : "bg-[#737168]"
                }`}
              ></span>
              <span className="font-bold text-[#121316] truncate">{marketStatus.label}</span>
              <span className="text-[#737168] hidden sm:inline truncate">• {marketStatus.sublabel}</span>
            </div>

            {/* Data Freshness & Sync Status Badge */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-2 py-1 bg-white border border-[#E5E3DC] hover:border-[#121316] text-[10px] font-mono select-none transition active:scale-95 cursor-pointer shrink-0 truncate max-w-[50%] sm:max-w-none"
              title={
                isOffline
                  ? `Mode Offline: Menampilkan data tersimpan (${formatWibDateTime(lastDataTimestamp, { includeDay: true })}). Klik untuk coba sinkronisasi ulang.`
                  : syncSource === "cloud"
                  ? `Data tersinkron dari GitHub Raw CDN (${formatWibDateTime(lastDataTimestamp, { includeDay: true })}). Klik untuk refresh.`
                  : `Data dari aset bundled lokal APK (${formatWibDateTime(lastDataTimestamp, { includeDay: true })}). Klik untuk refresh.`
              }
            >
              {isRefreshing ? (
                <RefreshCw className="w-3 h-3 text-[#121316] animate-spin shrink-0" />
              ) : isOffline ? (
                <WifiOff className="w-3 h-3 text-[#D97706] shrink-0" />
              ) : syncSource === "cloud" ? (
                <Cloud className="w-3 h-3 text-[#1B5E20] shrink-0" />
              ) : (
                <HardDrive className="w-3 h-3 text-[#1565C0] shrink-0" />
              )}
              <span className="text-[#121316] font-medium truncate">
                {isRefreshing
                  ? "Menyinkronkan..."
                  : lastDataTimestamp
                  ? `Update: ${formatWibDateTime(lastDataTimestamp, { short: true })}`
                  : "Data Siap"}
              </span>
              <span
                className={`px-1 py-0.2 text-[9px] font-bold uppercase tracking-tight border shrink-0 hidden xs:inline ${
                  isOffline
                    ? "bg-[#FEF3C7] text-[#D97706] border-[#D97706]/40"
                    : syncSource === "cloud"
                    ? "bg-[#E8F5E9] text-[#1B5E20] border-[#1B5E20]/40"
                    : "bg-[#E3F2FD] text-[#1565C0] border-[#1565C0]/40"
                }`}
              >
                {isOffline ? "Offline" : syncSource === "cloud" ? "Cloud" : "Lokal"}
              </span>
            </button>
          </div>
        </div>

        {/* Row 3: Slim Editorial Market Context & Freshness Ticker Strip */}
        <div
          onClick={onRefresh}
          className="border-t border-[#E5E3DC] -mx-3.5 sm:-mx-4 px-3.5 sm:px-4 py-1 bg-[#F5F4EF] hover:bg-[#EFECE6] transition cursor-pointer flex items-center justify-between text-[10px] font-mono text-[#595750] select-none"
          title="Klik untuk menyinkronkan data prediksi terbaru"
        >
          <div className="flex items-center space-x-1.5 min-w-0 truncate pr-2">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRefreshing
                  ? "bg-[#1565C0] animate-ping"
                  : marketStatus.isOpen
                  ? "bg-[#1B5E20]"
                  : "bg-[#737168]"
              }`}
            ></span>
            <span className="truncate">
              {isRefreshing ? (
                <span className="text-[#1565C0] font-semibold">Mengunduh prediksi terbaru dari GitHub Raw...</span>
              ) : marketStatus.isOpen ? (
                <>
                  <strong className="text-[#121316]">Pasar BEI Buka</strong>: Model ML berbasis harga penutupan terakhir. Pipeline update tiap 16:30 WIB.
                </>
              ) : (
                <>
                  <strong className="text-[#121316]">Pasar BEI Tutup</strong>:
                  {lastDataTimestamp
                    ? ` Data Penutupan ${formatWibDateTime(lastDataTimestamp, { dateOnly: true })}`
                    : " Prediksi horizon 20 hari aktif."}
                </>
              )}
            </span>
          </div>

          <div className="shrink-0 text-right text-[9px] text-[#737168] flex items-center space-x-1">
            {isOffline ? (
              <span className="text-[#D97706] font-semibold flex items-center">
                <WifiOff className="w-2.5 h-2.5 mr-0.5" />
                Mode Offline
              </span>
            ) : syncSource === "cloud" ? (
              <span className="text-[#1B5E20] font-medium flex items-center">
                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                <span className="hidden sm:inline">Tersinkron </span>GitHub Raw
              </span>
            ) : (
              <span className="text-[#1565C0] font-medium">Aset APK</span>
            )}
            {lastSyncTime && (
              <span className="text-[#8C8A82]">
                • {formatRelativeTime(lastSyncTime)}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
