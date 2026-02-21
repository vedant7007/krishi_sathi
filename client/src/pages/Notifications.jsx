import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { translateCrop, formatDate } from '../utils/translate';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  generateSmartNotifications,
} from '../services/notificationService';
import {
  Bell,
  BellOff,
  CloudSun,
  TrendingUp,
  Landmark,
  AlertTriangle,
  Sprout,
  Check,
  CheckCheck,
  Trash2,
  Loader2,
  Filter,
} from 'lucide-react';

const FILTER_TABS = [
  { key: 'all', tKey: 'notifications.filterAll' },
  { key: 'unread', tKey: 'notifications.filterUnread' },
  { key: 'weather', tKey: 'notifications.filterWeather' },
  { key: 'price', tKey: 'notifications.filterPrice' },
  { key: 'scheme', tKey: 'notifications.filterScheme' },
  { key: 'emergency', tKey: 'notifications.filterEmergency' },
];

const TYPE_ICON_MAP = {
  weather: CloudSun,
  price: TrendingUp,
  scheme: Landmark,
  emergency: AlertTriangle,
  crop_advisory: Sprout,
  general: Bell,
};

const PRIORITY_STYLES = {
  critical: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-800',
    iconColor: 'text-red-600',
  },
  high: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-800',
    iconColor: 'text-orange-600',
  },
  medium: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-800',
    iconColor: 'text-blue-600',
  },
  low: {
    border: 'border-l-gray-400',
    bg: 'bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
    iconColor: 'text-gray-500',
  },
};

function NotificationCard({ notification, t, onMarkRead, onDelete }) {
  const type = notification.type || 'general';
  const priority = (notification.priority || 'medium').toLowerCase();
  const Icon = TYPE_ICON_MAP[type] || Bell;
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  const isUnread = !notification.read;

  // Pre-translate dynamic values (crop names, locations) before interpolation
  const translatedData = notification.data ? { ...notification.data } : {};
  if (translatedData.crop) {
    const cropKey = 'crops.' + translatedData.crop.toLowerCase().replace(/\s+/g, '_');
    const translated = t(cropKey, { defaultValue: '' });
    if (translated) translatedData.crop = translated;
  }
  if (translatedData.location) {
    // Capitalize location names
    translatedData.location = translatedData.location.charAt(0).toUpperCase() + translatedData.location.slice(1);
  }

  const getRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('notifications.justNow');
    if (minutes < 60) return t('notifications.minutesAgo', { count: minutes });
    if (hours < 24) return t('notifications.hoursAgo', { count: hours });
    return t('notifications.daysAgo', { count: days });
  };

  const handleClick = () => {
    if (isUnread) {
      onMarkRead(notification._id || notification.id);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(notification._id || notification.id);
  };

  return (
    <div
      onClick={handleClick}
      className={`card border-l-4 ${style.border} ${isUnread ? style.bg : 'bg-white'} cursor-pointer transition-all hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Unread indicator */}
            {isUnread && (
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>
              {t(`notifications.priority.${priority}`)}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {t(`notifications.type.${type}`, type.replace(/_/g, ' '))}
            </span>
          </div>

          <h3 className={`font-bold text-gray-900 text-sm ${isUnread ? '' : 'font-semibold'}`}>
            {translatedData.tKey
              ? t(translatedData.tKey, translatedData)
              : notification.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed line-clamp-2">
            {translatedData.mKey
              ? t(translatedData.mKey, translatedData)
              : notification.message}
          </p>

          {/* Time and actions */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {getRelativeTime(notification.createdAt)}
            </span>
            <div className="flex items-center gap-2">
              {isUnread && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification._id || notification.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-800 transition-colors"
                  aria-label={t('notifications.markAsRead')}
                  title={t('notifications.markAsRead')}
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                aria-label={t('notifications.delete')}
                title={t('notifications.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { t } = useTranslation();
  const { user } = useFarm();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const LIMIT = 15;

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      const inner = response?.data || response;
      setUnreadCount(inner?.count ?? inner?.unreadCount ?? 0);
    } catch {
      // Silently fail for count
    }
  }, []);

  const fetchNotifications = useCallback(
    async (pageNum = 1, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError('');

      try {
        const params = {
          page: pageNum,
          limit: LIMIT,
        };

        if (activeFilter === 'unread') {
          params.unreadOnly = true;
        } else if (activeFilter !== 'all') {
          params.type = activeFilter;
        }

        const response = await getNotifications(params);
        const inner = response?.data || response;
        const items = inner?.notifications || [];

        if (append) {
          setNotifications((prev) => [...prev, ...items]);
        } else {
          setNotifications(items);
        }

        // Determine if there are more pages
        const total = inner?.total || inner?.totalCount || 0;
        setHasMore(pageNum * LIMIT < total);
      } catch (err) {
        setError(err?.response?.data?.message || t('common.error'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeFilter, t]
  );

  // On mount: generate smart notifications, then fetch
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setGenerating(true);
      try {
        await generateSmartNotifications();
      } catch {
        // Silently fail - notifications may still exist
      } finally {
        if (!cancelled) setGenerating(false);
      }

      if (!cancelled) {
        fetchNotifications(1, false);
        fetchUnreadCount();
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filter changes (but not on first mount)
  useEffect(() => {
    setPage(1);
    fetchNotifications(1, false);
  }, [activeFilter, fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          (n._id || n.id) === id ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) =>
        prev.filter((n) => (n._id || n.id) !== id)
      );
      // Refresh unread count in case it was unread
      fetchUnreadCount();
    } catch {
      // Silently fail
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-800 to-green-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            {t('notifications.title')}
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-primary-800">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 text-sm font-semibold bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Filter Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors min-h-touch flex items-center gap-1.5 ${
                activeFilter === tab.key
                  ? 'bg-primary-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.key === 'all' && <Filter className="w-3.5 h-3.5" />}
              {t(tab.tKey)}
            </button>
          ))}
        </div>

        {/* Generating indicator */}
        {generating && (
          <div className="card flex items-center gap-3 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin text-primary-800" />
            {t('notifications.generating')}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card border-red-200 bg-red-50 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card space-y-3">
                <div className="flex items-center gap-2">
                  <div className="skeleton w-5 h-5 rounded-full" />
                  <div className="skeleton h-4 w-16" />
                  <div className="skeleton h-4 w-12" />
                </div>
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-3 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Notifications List */}
        {!loading && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notification, i) => (
              <NotificationCard
                key={notification._id || notification.id || i}
                notification={notification}
                t={t}
                onMarkRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}

            {/* Load More */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-primary w-full"
              >
                {loadingMore ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('notifications.loadMore')
                )}
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && !error && (
          <div className="card text-center py-12">
            <BellOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {t('notifications.empty')}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              {t('notifications.emptyDescription')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
