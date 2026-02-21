import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { getWeather } from '../services/weatherService';
import {
  translateWeatherCondition,
  translateFarmingAction,
  formatDate,
  getDayName,
  getLang,
} from '../utils/translate';
import {
  MapPin,
  Search,
  Loader2,
  AlertTriangle,
  Droplets,
  Wind,
  CloudRain,
  CloudSun,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEATHER_EMOJI = {
  clear: '\u2600\uFE0F',
  sunny: '\uD83C\uDF1E',
  'partly cloudy': '\u26C5',
  cloudy: '\u2601\uFE0F',
  clouds: '\u2601\uFE0F',
  overcast: '\u2601\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  'light rain': '\uD83C\uDF27\uFE0F',
  'moderate rain': '\uD83C\uDF27\uFE0F',
  'heavy rain': '\uD83C\uDF27\uFE0F',
  drizzle: '\uD83C\uDF27\uFE0F',
  thunderstorm: '\u26C8\uFE0F',
  haze: '\uD83C\uDF2B\uFE0F',
  mist: '\uD83C\uDF2B\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
  snow: '\u2744\uFE0F',
  smoke: '\uD83C\uDF2B\uFE0F',
  dust: '\uD83C\uDF2B\uFE0F',
};

const SEVERITY_EMOJI = {
  info: '\u2705',
  success: '\u2705',
  low: '\u2705',
  warning: '\u26A0\uFE0F',
  caution: '\u26A0\uFE0F',
  medium: '\u26A0\uFE0F',
  critical: '\uD83D\uDEA8',
  high: '\uD83D\uDEA8',
  spray: '\uD83D\uDC1B',
  irrigate: '\uD83D\uDCA7',
  irrigation: '\uD83D\uDCA7',
  skip: '\u23ED\uFE0F',
  ideal: '\u2705',
  humid: '\uD83D\uDCA7',
};

const ACTION_BORDER_COLORS = {
  skip: 'border-l-info bg-blue-50',
  spray: 'border-l-alert-red bg-red-50',
  irrigate: 'border-l-primary-800 bg-primary-50',
  ideal: 'border-l-primary-500 bg-green-50',
  humid: 'border-l-accent-700 bg-accent-50',
  irrigation: 'border-l-primary-800 bg-primary-50',
  warning: 'border-l-accent-700 bg-amber-50',
  caution: 'border-l-accent-700 bg-amber-50',
  critical: 'border-l-alert-red bg-red-50',
  info: 'border-l-info bg-blue-50',
  success: 'border-l-primary-500 bg-green-50',
};

// ---------------------------------------------------------------------------
// Mock weather data fallback
// ---------------------------------------------------------------------------

const generateMockWeather = () => ({
  current: {
    temp: 32,
    humidity: 65,
    windSpeed: 12,
    rainfall: 0,
    condition: 'Partly Cloudy',
    icon: '02d',
    description: 'partly cloudy skies',
  },
  forecast: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
    tempMax: Math.round(34 - Math.random() * 4),
    tempMin: Math.round(22 + Math.random() * 4),
    humidity: Math.round(60 + Math.random() * 20),
    windSpeed: Math.round(8 + Math.random() * 15),
    rainfall: Math.random() > 0.7 ? Math.round(Math.random() * 20) : 0,
    rainProbability: Math.round(Math.random() * 80),
    condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][
      Math.floor(Math.random() * 4)
    ],
  })),
  farmingActions: [
    { action: 'Good conditions for field work', type: 'info', severity: 'low' },
    { action: 'Regular irrigation recommended', type: 'irrigation', severity: 'low' },
    { action: 'Monitor crops for pest activity', type: 'caution', severity: 'medium' },
  ],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a weather condition string to an emoji */
function getWeatherEmoji(condition) {
  if (!condition) return '\u26C5';
  const lower = condition.toLowerCase();
  // Direct lookup
  if (WEATHER_EMOJI[lower]) return WEATHER_EMOJI[lower];
  // Partial match
  for (const [key, emoji] of Object.entries(WEATHER_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '\u26C5';
}

/** Get the locale string for the current language */
function getLocale() {
  const lang = getLang();
  const map = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };
  return map[lang] || 'en-IN';
}

/** Format a date to show full date + day name in the user's locale */
function localFullDate(dateStr) {
  const d = new Date(dateStr);
  const locale = getLocale();
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Extrapolate 3 additional forecast days from the last available day
 * by adding slight random variations.
 */
function extrapolateForecast(forecast) {
  if (!forecast || forecast.length === 0) return [];

  const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Sunny'];
  const last = forecast[forecast.length - 1];
  const extraDays = [];

  for (let i = 1; i <= 3; i++) {
    const lastDate = new Date(last.date);
    const newDate = new Date(lastDate.getTime() + i * 86400000);
    const tempDelta = Math.round((Math.random() - 0.5) * 6);
    const humDelta = Math.round((Math.random() - 0.5) * 15);

    extraDays.push({
      date: newDate.toISOString(),
      tempMax: Math.round((last.tempMax || 34) + tempDelta),
      tempMin: Math.round((last.tempMin || 22) + tempDelta * 0.6),
      humidity: Math.max(20, Math.min(100, (last.humidity || 60) + humDelta)),
      windSpeed: Math.max(0, Math.round((last.windSpeed || 10) + (Math.random() - 0.5) * 8)),
      rainfall: Math.random() > 0.7 ? Math.round(Math.random() * 15) : 0,
      rainProbability: Math.round(Math.random() * 70),
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      _extrapolated: true,
    });
  }
  return extraDays;
}

/**
 * Generate crop-specific alerts based on weather and primary crop.
 */
function getCropAlerts(weatherData, crop, t) {
  const alerts = [];
  if (!weatherData?.current || !crop) return alerts;

  const { humidity, temp, rainfall, windSpeed } = weatherData.current;

  if (crop === 'cotton' && humidity > 80) {
    alerts.push({
      type: 'warning',
      message: t('weather.cottonBollworm'),
    });
  }

  if (crop === 'rice' && temp > 38) {
    alerts.push({
      type: 'warning',
      message: t('weather.riceHeatStress'),
    });
  }

  if (rainfall > 50) {
    alerts.push({
      type: 'critical',
      message: t('weather.heavyRainDrainage'),
    });
  }

  if (windSpeed > 30) {
    alerts.push({
      type: 'warning',
      message: t('weather.highWindSpray'),
    });
  }

  if (humidity < 30) {
    alerts.push({
      type: 'info',
      message: t('weather.lowHumidityHarvest'),
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Loading skeleton shown while fetching */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 -mt-4">
      {/* Current weather skeleton */}
      <div className="card animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-10 w-28 bg-gray-200 rounded" />
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
          <div className="h-16 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          {[1, 2, 3].map((n) => (
            <div key={n} className="text-center space-y-2">
              <div className="h-5 w-5 bg-gray-200 rounded-full mx-auto" />
              <div className="h-3 w-14 bg-gray-200 rounded mx-auto" />
              <div className="h-4 w-10 bg-gray-200 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* Farming actions skeleton */}
      <div className="card animate-pulse">
        <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
      {/* Forecast skeleton */}
      <div className="card animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-36 w-28 bg-gray-200 rounded flex-shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Single farming action card */
function FarmingActionCard({ action }) {
  const actionText = translateFarmingAction(action.action) || action.action;
  const emoji =
    SEVERITY_EMOJI[action.type] || SEVERITY_EMOJI[action.severity] || '\u2139\uFE0F';
  const borderClass =
    ACTION_BORDER_COLORS[action.type] ||
    ACTION_BORDER_COLORS[action.severity] ||
    'border-l-gray-400 bg-gray-50';

  return (
    <div
      className={`border-l-4 rounded-r-xl p-3.5 min-h-touch flex items-start gap-3 ${borderClass}`}
    >
      <span className="text-lg flex-shrink-0 mt-0.5" aria-hidden="true">
        {emoji}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">
          {actionText}
        </p>
        {(action.detail || action.description) && (
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            {action.detail || action.description}
          </p>
        )}
      </div>
    </div>
  );
}

/** Single forecast day card */
function ForecastDayCard({ day, index, t }) {
  const date = new Date(day.date || Date.now() + index * 86400000);
  const dayName = index === 0 ? t('weather.today') : getDayName(date.toISOString());
  const shortDate = formatDate(date.toISOString());
  const emoji = getWeatherEmoji(day.condition);
  const conditionText = translateWeatherCondition(day.condition);

  return (
    <div
      className={`card min-w-[115px] flex-shrink-0 text-center py-3 px-2.5 ${
        day._extrapolated ? 'opacity-75 border-dashed' : ''
      }`}
    >
      <p className="text-xs font-bold text-gray-700 uppercase truncate">
        {dayName}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">{shortDate}</p>
      <div className="text-3xl my-2" aria-label={conditionText}>
        {emoji}
      </div>
      <p className="font-bold text-gray-900 text-sm leading-none">
        {day.tempMax ?? '--'}{t('units.celsius')}/{day.tempMin ?? '--'}{t('units.celsius')}
      </p>
      {(day.rainProbability !== undefined || day.rainfall !== undefined) && (
        <div className="flex items-center justify-center gap-1 mt-1.5 text-xs text-info">
          <Droplets className="w-3 h-3" />
          <span>{day.rainProbability ?? 0}{t('units.percent')}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Weather() {
  const { t } = useTranslation();
  const { user, setWeather: setGlobalWeather } = useFarm();

  const [location, setLocation] = useState(user?.district || '');
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usingMock, setUsingMock] = useState(false);
  const [detectingGPS, setDetectingGPS] = useState(false);

  const crop = user?.primaryCrop || '';

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchWeather = async (loc) => {
    if (!loc) return;
    setLocation(loc);
    setLoading(true);
    setError('');
    setUsingMock(false);
    try {
      const response = await getWeather(loc);
      const data = response.data || response;

      if (!data || !data.current) {
        const mock = generateMockWeather();
        setWeatherData(mock);
        setGlobalWeather(mock);
        setUsingMock(true);
        return;
      }

      setWeatherData(data);
      setGlobalWeather(data);
    } catch (err) {
      console.warn('Weather API failed, using mock data:', err?.message);
      const mock = generateMockWeather();
      setWeatherData(mock);
      setGlobalWeather(mock);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect location via GPS on mount, then fetch weather
  useEffect(() => {
    // If user has a district, use that directly
    if (user?.district) {
      fetchWeather(user.district);
      return;
    }

    // Otherwise try browser geolocation
    if (navigator.geolocation) {
      setDetectingGPS(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const resp = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await resp.json();
            const loc = data.city || data.locality || data.principalSubdivision || 'Hyderabad';
            setDetectingGPS(false);
            fetchWeather(loc);
          } catch {
            setDetectingGPS(false);
            fetchWeather('Hyderabad');
          }
        },
        () => {
          setDetectingGPS(false);
          fetchWeather('Hyderabad');
        },
        { timeout: 5000 }
      );
    } else {
      fetchWeather('Hyderabad');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchWeather(location);
  };

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const current = weatherData?.current;
  const currentTemp = current?.temp ?? current?.temperature;
  const currentCondition = current?.condition;

  // Build 10-day forecast: server's 7 + 3 extrapolated
  const fullForecast = useMemo(() => {
    if (!weatherData?.forecast || weatherData.forecast.length === 0) return [];
    const serverDays = weatherData.forecast.slice(0, 7);
    const extraDays = extrapolateForecast(serverDays);
    return [...serverDays, ...extraDays].slice(0, 10);
  }, [weatherData?.forecast]);

  // Farming actions (prefer server-provided, fallback to mock defaults)
  const farmingActions = useMemo(() => {
    const sa = weatherData?.farmingActions;
    return sa && sa.length > 0 ? sa : [];
  }, [weatherData?.farmingActions]);

  // Crop-specific alerts
  const cropAlerts = useMemo(
    () => getCropAlerts(weatherData, crop, t),
    [weatherData, crop, t]
  );

  // Today's full date string in the user's locale
  const todayDateStr = localFullDate(new Date().toISOString());

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* ============ Header ============ */}
      <div className="bg-gradient-to-br from-info to-blue-800 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <CloudSun className="w-6 h-6" />
          {t('weather.title')}
        </h1>
        <p className="text-blue-200 text-sm mb-4">{todayDateStr}</p>

        {/* Location search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-200" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('weather.enterLocation')}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-blue-200 outline-none focus:ring-2 focus:ring-white/40 min-h-touch text-base"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-info px-4 rounded-xl font-semibold min-h-touch min-w-touch flex items-center justify-center active:scale-95 transition-transform"
            aria-label={t('common.search')}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      {/* ============ Content ============ */}
      <div className="px-4 -mt-4 space-y-4">
        {/* Mock data notice */}
        {usingMock && (
          <div className="card border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{t('weather.mockNotice')}</p>
          </div>
        )}

        {/* Error state with retry */}
        {error && !usingMock && (
          <div className="card border-red-200 bg-red-50 text-alert-red text-center py-8">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-alert-red" />
            <p className="font-semibold mb-1">{t('common.error')}</p>
            <p className="text-sm text-gray-600 mb-4">{t('weather.errorFetch')}</p>
            <button
              onClick={() => fetchWeather(location)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-800 text-white rounded-xl font-semibold min-h-touch active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* GPS detecting indicator */}
        {detectingGPS && (
          <div className="card flex items-center gap-3 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin text-info" />
            <MapPin className="w-4 h-4 text-info" />
            {t('profile.detectingLocation')}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !weatherData && <LoadingSkeleton />}

        {/* ============ Weather data ============ */}
        {current && (
          <>
            {/* ---------- Today's Weather ---------- */}
            <div className="card bg-gradient-to-br from-blue-50 to-white">
              {/* Section header */}
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                <span>{'\uD83C\uDF24\uFE0F'}</span>
                {t('weather.todaysWeather')}
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  {/* Location pin */}
                  {location && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {weatherData?.location || location}
                    </p>
                  )}
                  {/* Temperature */}
                  <p className="text-5xl font-bold text-gray-900 leading-none">
                    {currentTemp !== undefined ? currentTemp : '--'}
                    <span className="text-3xl">{t('units.celsius')}</span>
                  </p>
                  {/* Condition text (translated) */}
                  <p className="text-base text-gray-700 capitalize mt-1.5">
                    {getWeatherEmoji(currentCondition)}{' '}
                    {translateWeatherCondition(currentCondition) ||
                      current?.description ||
                      ''}
                  </p>
                </div>
                {/* Large weather emoji */}
                <span className="text-6xl" aria-hidden="true">
                  {getWeatherEmoji(currentCondition)}
                </span>
              </div>

              {/* Humidity / Wind / Rainfall row */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <Droplets className="w-5 h-5 text-info mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{t('weather.humidity')}</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {current.humidity !== undefined
                      ? `${current.humidity}${t('units.percent')}`
                      : '--'}
                  </p>
                </div>
                <div className="text-center">
                  <Wind className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{t('weather.wind')}</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {current.windSpeed !== undefined
                      ? `${current.windSpeed} ${t('units.kmph')}`
                      : '--'}
                  </p>
                </div>
                <div className="text-center">
                  <CloudRain className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{t('weather.rainfall')}</p>
                  <p className="font-bold text-gray-900 text-sm">
                    {current.rainfall !== undefined
                      ? `${current.rainfall} ${t('units.mm')}`
                      : `0 ${t('units.mm')}`}
                  </p>
                </div>
              </div>
            </div>

            {/* ---------- Farming Actions ---------- */}
            {farmingActions.length > 0 && (
              <div>
                <h2 className="section-title mb-3 flex items-center gap-1.5">
                  <span>{'\uD83C\uDF3E'}</span>
                  {t('weather.farmingAction')}
                </h2>
                <div className="space-y-2">
                  {farmingActions.map((action, i) => (
                    <FarmingActionCard key={i} action={action} />
                  ))}
                </div>
              </div>
            )}

            {/* ---------- 10-Day Forecast ---------- */}
            {fullForecast.length > 0 && (
              <div>
                <h2 className="section-title mb-3 flex items-center gap-1.5">
                  <span>{'\uD83D\uDCC5'}</span>
                  {t('weather.forecast')}
                </h2>
                <div className="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1 scrollbar-hide">
                  {fullForecast.map((day, i) => (
                    <ForecastDayCard key={i} day={day} index={i} t={t} />
                  ))}
                </div>
                {/* Note about extrapolated days */}
                {fullForecast.some((d) => d._extrapolated) && (
                  <p className="text-[11px] text-gray-400 mt-1.5 italic">
                    {t('weather.extrapolatedNotice')}
                  </p>
                )}
              </div>
            )}

            {/* ---------- Crop-Specific Alerts ---------- */}
            {cropAlerts.length > 0 && (
              <div>
                <h2 className="section-title mb-3 flex items-center gap-1.5">
                  <span>{'\uD83C\uDF3E'}</span>
                  {t('weather.cropAlerts')}
                </h2>
                <div className="space-y-2">
                  {cropAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`card flex items-start gap-3 border-l-4 ${
                        alert.type === 'critical'
                          ? 'border-l-alert-red bg-red-50'
                          : alert.type === 'warning'
                          ? 'border-l-accent-700 bg-amber-50'
                          : 'border-l-info bg-blue-50'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          alert.type === 'critical'
                            ? 'text-alert-red'
                            : alert.type === 'warning'
                            ? 'text-accent-700'
                            : 'text-info'
                        }`}
                      />
                      <p className="text-sm font-medium text-gray-800">
                        {alert.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ============ Empty state ============ */}
        {!loading && !weatherData && !error && (
          <div className="card text-center py-12">
            <CloudSun className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {t('weather.emptyState')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
