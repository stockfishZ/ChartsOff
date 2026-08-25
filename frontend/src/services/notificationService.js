import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";

// Local storage keys
const NOTIF_HISTORY_KEY = "chartsoff_notification_history";
const SENT_HASH_KEY = "chartsoff_sent_notif_hashes";
const NOTIF_SETTINGS_KEY = "chartsoff_notification_settings";

export class NotificationService {
  /**
   * Check if notifications are supported on the current platform
   */
  static isSupported() {
    return (
      typeof window !== "undefined" &&
      ("Notification" in window || typeof LocalNotifications !== "undefined")
    );
  }

  /**
   * Initialize background/foreground lifecycle listener
   */
  static initLifecycle(onForegroundSync = null, onBackgroundSchedule = null) {
    try {
      if (typeof App !== "undefined" && App.addListener) {
        App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) {
            // App came to foreground -> sync latest cloud data and notifications
            if (onForegroundSync) onForegroundSync();
          } else {
            // App minimized / backgrounded -> execute background scheduling
            if (onBackgroundSchedule) onBackgroundSchedule();
          }
        });
      }
    } catch (e) {
      console.warn("App lifecycle listener error:", e);
    }
  }

  /**
   * Request notification permission from Capacitor or Browser and setup Android Channels & Deep-link Action Listeners
   */
  static async requestPermission(onActionCallback = null) {
    try {
      if (typeof LocalNotifications !== "undefined") {
        // Create high-importance Android Notification Channel
        try {
          await LocalNotifications.createChannel({
            id: "chartsoff_alerts",
            name: "ChartsOff Market & Risk Alerts",
            description: "High-precision urgent sell, prime buy, and stock alerts",
            importance: 5, // MAX importance (heads-up popup)
            visibility: 1, // PUBLIC (shows on lock screen)
            vibration: true,
            lights: true,
            lightColor: "#1B5E20",
          });
        } catch (e) {}

        // Listen for user tapping the notification banner on Android
        if (onActionCallback) {
          try {
            await LocalNotifications.removeAllListeners();
            await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
              const extra = action.notification?.extra || {};
              if (extra.type === "NEWS_CATALYST" && extra.link) {
                // Scenario 1: News about a stock -> Drag user directly to news link
                window.open(extra.link, "_blank", "noopener,noreferrer");
              } else if (extra.ticker) {
                // Scenario 2: Stock price swing / Urgent sell / Prime buy -> Drag user directly to stock's page
                onActionCallback(extra.ticker, extra);
              }
            });
          } catch (e) {}
        }

        const check = await LocalNotifications.checkPermissions();
        if (check.display !== "granted") {
          const req = await LocalNotifications.requestPermissions();
          return req.display === "granted";
        }
        return true;
      }
      
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        return perm === "granted";
      }
    } catch (e) {
      console.warn("Notification permission error:", e);
    }
    return false;
  }

  /**
   * Get all stored notification history
   */
  static getHistory() {
    try {
      const saved = localStorage.getItem(NOTIF_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear all notification history
   */
  static clearHistory() {
    try {
      localStorage.removeItem(NOTIF_HISTORY_KEY);
    } catch (e) {}
  }

  /**
   * Mark all notifications as read
   */
  static markAllAsRead() {
    try {
      const history = this.getHistory();
      const updated = history.map((item) => ({ ...item, isRead: true }));
      localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  static getUnreadCount() {
    const history = this.getHistory();
    return history.filter((n) => !n.isRead).length;
  }

  /**
   * Core engine: Analyzes predictions against user portfolio & favorites,
   * firing native Android & Web notifications for:
   * 1. Ups and downs of starred/bought stocks
   * 2. URGENT SELL emergency warnings for portfolio holdings
   * 3. PRIME BUY high-conviction opportunities for starred stocks
   * 4. Breaking corporate news alerts
   */
  static async evaluateAndSendNotifications(predictions, portfolio, favorites) {
    if (!Array.isArray(predictions) || predictions.length === 0) return [];

    const portfolioTickers = new Set(Object.keys(portfolio || {}));
    const favoriteTickers = new Set(Array.isArray(favorites) ? favorites : []);
    
    // Combine monitored tickers
    const monitoredTickers = new Set([...portfolioTickers, ...favoriteTickers]);
    if (monitoredTickers.size === 0) return [];

    let sentHashes = {};
    try {
      const rawHashes = localStorage.getItem(SENT_HASH_KEY);
      sentHashes = rawHashes ? JSON.parse(rawHashes) : {};
    } catch (e) {}

    const now = Date.now();
    const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours cooldown per unique alert
    const newAlerts = [];

    for (const pred of predictions) {
      const ticker = pred.ticker;
      if (!monitoredTickers.has(ticker)) continue;

      const isHolding = portfolioTickers.has(ticker);
      const isStarred = favoriteTickers.has(ticker);
      const cleanTicker = ticker.replace(".JK", "");
      const alert = pred.action_alert || {};
      const alertType = alert.type || "NONE";

      // =======================================================================
      // SCENARIO 1: URGENT SELL (Emergency Sell Alert on Portfolio / Starred)
      // =======================================================================
      if (alertType === "URGENT_SELL") {
        const hash = `URGENT_SELL_${ticker}_${alert.precision_score}`;
        if (!sentHashes[hash] || (now - sentHashes[hash]) > COOLDOWN_MS) {
          const title = `⚠️ Jual Darurat: ${cleanTicker}`;
          const body = isHolding
            ? `Peringatan Portofolio: Kondisi ${cleanTicker} memburuk tajam. Disarankan pertimbangkan exit untuk amankan modal.`
            : `Peringatan Saham Favorit: Indikator ${cleanTicker} mengalami breakdown teknikal & tekanan jual berat.`;

          newAlerts.push({
            id: hash,
            ticker: ticker,
            type: "URGENT_SELL",
            urgency: "HIGH",
            title,
            body,
            timestamp: new Date().toISOString(),
            isRead: false,
            data: { ticker, currentPrice: pred.current_price, roc5: alert.roc_5 }
          });
          sentHashes[hash] = now;
        }
      }

      // =======================================================================
      // SCENARIO 2: PRIME BUY / PROSPEK BAGUS (High-Conviction Buying Setup on Starred Stocks)
      // =======================================================================
      else if (alertType === "PRIME_BUY" && (isStarred || !isHolding)) {
        const hash = `PRIME_BUY_${ticker}_${alert.precision_score}`;
        if (!sentHashes[hash] || (now - sentHashes[hash]) > COOLDOWN_MS) {
          const title = `🎯 Prospek Bagus: ${cleanTicker}`;
          const body = `Setup kuantitatif ${cleanTicker} menunjukkan prospek bagus. Terkonfirmasi Golden Cross & akumulasi volume (Keyakinan ${pred.confidence}%).`;

          newAlerts.push({
            id: hash,
            ticker: ticker,
            type: "PRIME_BUY",
            urgency: "HIGH",
            title,
            body,
            timestamp: new Date().toISOString(),
            isRead: false,
            data: { ticker, currentPrice: pred.current_price, expectedReturn: pred.expected_return_pct }
          });
          sentHashes[hash] = now;
        }
      }

      // =======================================================================
      // SCENARIO 3: SIGNIFICANT PRICE SWING (Ups & Downs for Starred / Bought)
      // =======================================================================
      else if (alertType === "PRICE_SWING" || Math.abs(pred.expected_return_pct || 0) >= 4.0) {
        const movePct = alert.roc_5 || pred.expected_return_pct || 0;
        const hash = `PRICE_SWING_${ticker}_${Math.round(movePct)}`;
        if (!sentHashes[hash] || (now - sentHashes[hash]) > COOLDOWN_MS) {
          const direction = movePct >= 0 ? "menguat" : "terkoreksi";
          const title = `${movePct >= 0 ? "📈" : "📉"} Pergerakan ${cleanTicker}: ${movePct >= 0 ? "+" : ""}${movePct}%`;
          const body = isHolding
            ? `Saham portofolio ${cleanTicker} tercatat ${direction} ${Math.abs(movePct)}%. Harga saat ini: Rp ${pred.current_price.toLocaleString("id-ID")}.`
            : `Saham favorit ${cleanTicker} tercatat ${direction} ${Math.abs(movePct)}%.`;

          newAlerts.push({
            id: hash,
            ticker: ticker,
            type: "PRICE_SWING",
            urgency: "MEDIUM",
            title,
            body,
            timestamp: new Date().toISOString(),
            isRead: false,
            data: { ticker, currentPrice: pred.current_price, movePct }
          });
          sentHashes[hash] = now;
        }
      }

      // =======================================================================
      // SCENARIO 4: MATERIAL NEWS CATALYST (Breaking News on Starred / Bought)
      // =======================================================================
      if (pred.news_sentiment && Math.abs(pred.news_sentiment.avg_sentiment || 0) >= 0.35) {
        const topNews = pred.news_sentiment.top_headlines?.[0];
        const topHeadline = topNews?.title || "";
        const newsLink = topNews?.link || "";
        if (topHeadline) {
          const headlineHash = `NEWS_${ticker}_${topHeadline.slice(0, 25)}`;
          if (!sentHashes[headlineHash] || (now - sentHashes[headlineHash]) > COOLDOWN_MS) {
            const isPos = pred.news_sentiment.avg_sentiment > 0;
            const title = `📰 Berita ${isPos ? "Positif" : "Penting"}: ${cleanTicker}`;
            const body = topHeadline;

            newAlerts.push({
              id: headlineHash,
              ticker: ticker,
              type: "NEWS_CATALYST",
              urgency: isPos ? "LOW" : "MEDIUM",
              title,
              body,
              link: newsLink,
              timestamp: new Date().toISOString(),
              isRead: false,
              data: {
                type: "NEWS_CATALYST",
                ticker,
                link: newsLink,
                sentiment: pred.news_sentiment.avg_sentiment
              }
            });
            sentHashes[headlineHash] = now;
          }
        }
      }
    }

    // Persist sent hashes
    try {
      localStorage.setItem(SENT_HASH_KEY, JSON.stringify(sentHashes));
    } catch (e) {}

    // Dispatch Native Android & Web Notifications
    if (newAlerts.length > 0) {
      const existingHistory = this.getHistory();
      const updatedHistory = [...newAlerts, ...existingHistory].slice(0, 50);
      try {
        localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch (e) {}

      // Send via LocalNotifications (Android) or Web Notification
      for (const alert of newAlerts) {
        await this._dispatchSingleNotification(alert);
      }
    }

    return newAlerts;
  }

  /**
   * Internal dispatcher for individual notifications
   */
  static async _dispatchSingleNotification(alert) {
    // 1. Try Capacitor Native Android Notification
    try {
      if (typeof LocalNotifications !== "undefined") {
        const notifId = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: alert.title,
              body: alert.body,
              channelId: "chartsoff_alerts",
              schedule: { at: new Date(Date.now() + 500) },
              sound: alert.urgency === "HIGH" ? "beep.wav" : undefined,
              extra: alert.data
            }
          ]
        });
        return;
      }
    } catch (e) {
      console.warn("LocalNotifications dispatch error:", e);
    }

    // 2. Web Notification Fallback
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notif = new Notification(alert.title, {
          body: alert.body,
          icon: "/favicon.ico",
          tag: alert.id,
          data: alert.data
        });
        notif.onclick = () => {
          window.focus();
          if (alert.type === "NEWS_CATALYST" && (alert.link || alert.data?.link)) {
            window.open(alert.link || alert.data?.link, "_blank", "noopener,noreferrer");
          } else if (alert.ticker && window.__onChartsOffStockSelect) {
            window.__onChartsOffStockSelect(alert.ticker);
          }
        };
      }
    } catch (e) {
      console.warn("Web Notification error:", e);
    }
  }
}
