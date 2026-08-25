import React, { useState } from "react";
import { X, Bell, Trash2, CheckCircle2, ArrowRight, ExternalLink, ShieldAlert, Sparkles, TrendingUp, Newspaper } from "lucide-react";
import { NotificationService } from "../services/notificationService";

export default function NotificationCenterModal({
  isOpen,
  onClose,
  notifications,
  onSelectTicker,
  onClearAll,
  onMarkAllAsRead,
}) {
  const [filter, setFilter] = useState("ALL");

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === "ALL") return true;
    return item.type === filter;
  });

  const handleItemClick = (notif) => {
    if (!notif) return;
    
    // Scenario 1: News about a stock -> drag user directly to the external news link
    if (notif.type === "NEWS_CATALYST" && (notif.link || notif.data?.link)) {
      const targetUrl = notif.link || notif.data?.link;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      onClose();
      return;
    }

    // Scenario 2: Stock price swing / Urgent sell / Prime buy -> send user to stock's page
    if (notif.ticker && onSelectTicker) {
      onSelectTicker(notif.ticker);
      onClose();
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "URGENT_SELL":
        return <ShieldAlert className="w-4 h-4 text-[#B71C1C]" />;
      case "PRIME_BUY":
        return <Sparkles className="w-4 h-4 text-[#1B5E20]" />;
      case "PRICE_SWING":
        return <TrendingUp className="w-4 h-4 text-[#121316]" />;
      case "NEWS_CATALYST":
        return <Newspaper className="w-4 h-4 text-[#E65100]" />;
      default:
        return <Bell className="w-4 h-4 text-[#737168]" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "URGENT_SELL":
        return (
          <span className="text-[9px] font-mono font-bold uppercase text-[#B71C1C] bg-[#FFEBEE] px-1.5 py-0.5 border border-[#B71C1C]/30">
            Jual Darurat
          </span>
        );
      case "PRIME_BUY":
        return (
          <span className="text-[9px] font-mono font-bold uppercase text-[#1B5E20] bg-[#E8F5E9] px-1.5 py-0.5 border border-[#1B5E20]/30">
            Peluang Beli
          </span>
        );
      case "PRICE_SWING":
        return (
          <span className="text-[9px] font-mono font-bold uppercase text-[#121316] bg-[#F1EFEA] px-1.5 py-0.5 border border-[#121316]/30">
            Pergerakan Harga
          </span>
        );
      case "NEWS_CATALYST":
        return (
          <span className="text-[9px] font-mono font-bold uppercase text-[#E65100] bg-[#FFF3E0] px-1.5 py-0.5 border border-[#E65100]/30">
            Berita Katalis
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] border-2 border-[#121316] w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden text-[#121316]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-white border-b border-[#121316] p-4 sm:px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-[#121316]" />
            <h2 className="font-editorial font-bold text-lg sm:text-xl text-[#121316]">
              Notifikasi
            </h2>
            {notifications.some((n) => !n.isRead) && (
              <span className="w-2 h-2 rounded-full bg-[#B71C1C]" />
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="px-2 py-1 border border-[#E5E3DC] hover:border-[#121316] bg-[#FAF9F6] text-[10px] font-mono text-[#595750] transition cursor-pointer"
                  title="Tandai Sudah Dibaca"
                >
                  Tandai Dibaca
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="p-1 border border-[#E5E3DC] hover:border-[#B71C1C] hover:text-[#B71C1C] bg-[#FAF9F6] text-[#737168] transition cursor-pointer"
                  title="Hapus Semua Riwayat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 border border-[#121316] bg-[#FAF9F6] hover:bg-[#121316] hover:text-white transition active:scale-95 cursor-pointer ml-1"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 px-4 py-2 bg-[#F1EFEA] border-b border-[#E5E3DC] overflow-x-auto text-[10px] font-mono shrink-0">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-2 py-0.5 border transition cursor-pointer shrink-0 ${
              filter === "ALL"
                ? "bg-[#121316] text-white border-[#121316]"
                : "bg-white text-[#595750] border-[#DCDAD4] hover:border-[#121316]"
            }`}
          >
            Semua ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("URGENT_SELL")}
            className={`px-2 py-0.5 border transition cursor-pointer shrink-0 ${
              filter === "URGENT_SELL"
                ? "bg-[#B71C1C] text-white border-[#B71C1C]"
                : "bg-white text-[#B71C1C] border-[#DCDAD4] hover:border-[#B71C1C]"
            }`}
          >
            Jual Darurat
          </button>
          <button
            type="button"
            onClick={() => setFilter("PRIME_BUY")}
            className={`px-2 py-0.5 border transition cursor-pointer shrink-0 ${
              filter === "PRIME_BUY"
                ? "bg-[#1B5E20] text-white border-[#1B5E20]"
                : "bg-white text-[#1B5E20] border-[#DCDAD4] hover:border-[#1B5E20]"
            }`}
          >
            Peluang Beli
          </button>
          <button
            type="button"
            onClick={() => setFilter("PRICE_SWING")}
            className={`px-2 py-0.5 border transition cursor-pointer shrink-0 ${
              filter === "PRICE_SWING"
                ? "bg-[#121316] text-white border-[#121316]"
                : "bg-white text-[#595750] border-[#DCDAD4] hover:border-[#121316]"
            }`}
          >
            Pergerakan
          </button>
          <button
            type="button"
            onClick={() => setFilter("NEWS_CATALYST")}
            className={`px-2 py-0.5 border transition cursor-pointer shrink-0 ${
              filter === "NEWS_CATALYST"
                ? "bg-[#E65100] text-white border-[#E65100]"
                : "bg-white text-[#E65100] border-[#DCDAD4] hover:border-[#E65100]"
            }`}
          >
            Berita
          </button>
        </div>

        {/* Scrollable Notification List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-[#E5E3DC]/60">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Bell className="w-8 h-8 text-[#DCDAD4] mx-auto mb-2" />
              <p className="font-editorial text-sm font-bold text-[#121316]">
                Tidak Ada Peringatan Baru
              </p>
              <p className="text-xs text-[#737168] mt-1 max-w-xs mx-auto leading-relaxed">
                Model ML memantau pergerakan harga, sinyal darurat, dan katalis berita untuk saham yang Anda bintangi & miliki.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`pt-2.5 first:pt-0 p-2.5 rounded-none border transition cursor-pointer group ${
                  notif.type === "URGENT_SELL"
                    ? "bg-[#FFEBEE]/40 border-[#B71C1C]/40 hover:bg-[#FFEBEE]/70"
                    : notif.type === "PRIME_BUY"
                    ? "bg-[#E8F5E9]/40 border-[#1B5E20]/40 hover:bg-[#E8F5E9]/70"
                    : "bg-white border-[#E5E3DC] hover:border-[#121316]"
                } ${!notif.isRead ? "border-l-3 border-l-[#121316]" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    {getTypeIcon(notif.type)}
                    <span className="font-sans font-bold text-xs text-[#121316] truncate">
                      {notif.title}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center space-x-1">
                    {getTypeBadge(notif.type)}
                  </div>
                </div>

                <p className="text-[11px] text-[#595750] leading-snug mb-2 pl-5.5">
                  {notif.body}
                </p>

                <div className="flex items-center justify-between text-[9px] font-mono text-[#737168] pl-5.5">
                  <span>
                    {notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Terkini"}
                  </span>
                  {notif.type === "NEWS_CATALYST" && (notif.link || notif.data?.link) ? (
                    <span className="text-[#E65100] font-bold group-hover:underline flex items-center space-x-0.5">
                      <span>Buka Berita</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </span>
                  ) : (
                    <span className="text-[#121316] font-bold group-hover:underline flex items-center space-x-0.5">
                      <span>Lihat Saham</span>
                      <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-[#121316] p-2.5 px-4 flex items-center justify-between shrink-0 text-[10px] font-mono text-[#737168]">
          <span>© StockfishZ • Precision Alert Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-[#121316] text-white hover:bg-black font-sans text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
