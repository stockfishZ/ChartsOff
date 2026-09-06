import { useState, useEffect, useMemo } from "react";
import { NotificationService } from "../services/notificationService";
import { syncHolidaysForYear } from "../services/holidayService";

export function useNotifications({
  predictions = [],
  portfolio = {},
  favorites = [],
  onSelectStock,
  onFetchPredictions,
} = {}) {
  const [notifications, setNotifications] = useState(() => NotificationService.getHistory());
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Request notification permissions and initialize background/foreground lifecycle + Dynamic Holiday Sync
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    syncHolidaysForYear(currentYear);
    syncHolidaysForYear(currentYear + 1);

    window.__onChartsOffStockSelect = (ticker) => {
      if (ticker && onSelectStock) {
        onSelectStock(ticker);
      }
    };

    NotificationService.requestPermission((ticker) => {
      if (ticker && onSelectStock) {
        onSelectStock(ticker);
      }
    });

    NotificationService.initLifecycle(
      // On Foreground (user opens/resumes app): sync predictions
      () => {
        if (onFetchPredictions) onFetchPredictions();
      },
      // On Background (user minimizes / switches app): evaluate notifications
      () => {
        if (predictions && predictions.length > 0) {
          NotificationService.evaluateAndSendNotifications(predictions, portfolio, favorites);
        }
      }
    );

    return () => {
      delete window.__onChartsOffStockSelect;
    };
  }, [predictions, portfolio, favorites, onSelectStock, onFetchPredictions]);

  // Real-time evaluation of notifications when predictions/portfolio/favorites update
  useEffect(() => {
    if (predictions && predictions.length > 0) {
      NotificationService.evaluateAndSendNotifications(predictions, portfolio, favorites).then(() => {
        setNotifications(NotificationService.getHistory());
      });
    }
  }, [predictions, portfolio, favorites]);

  const handleClearAllNotifications = () => {
    NotificationService.clearHistory();
    setNotifications([]);
  };

  const handleMarkAllNotificationsAsRead = () => {
    const updated = NotificationService.markAllAsRead();
    setNotifications(updated);
  };

  return {
    notifications,
    setNotifications,
    unreadNotifCount,
    isNotifModalOpen,
    setIsNotifModalOpen,
    handleClearAllNotifications,
    handleMarkAllNotificationsAsRead,
  };
}

export default useNotifications;
