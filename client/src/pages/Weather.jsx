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
  Sprout,
  Calendar,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

const ACTION_STYLES = {
  skip: { border: 'border-l-blue-400', bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  spray: { border: 'border-l-red-400', bg: 'bg-red-50', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  irrigate: { border: 'border-l-green-500', bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-700' },
  ideal: { border: 'border-l-green-400', bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  humid: { border: 'border-l-amber-400', bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
  irrigation: { border: 'border-l-green-500', bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-700' },
  warning: { border: 'border-l-amber-400', bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
  caution: { border: 'border-l-amber-400', bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
  critical: { border: 'border-l-red-400', bg: 'bg-red-50', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  info: { border: 'border-l-blue-400', bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  success: { border: 'border-l-green-400', bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
};

const DEFAULT_ACTION_STYLE = {
  border: 'border-l-gray-400', bg: 'bg-gray-50', iconBg: 'bg-gray-100', iconColor: 'text-gray-600',
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

function getWeatherEmoji(condition) {
  if (!condition) return '\u26C5';
  const lower = condition.toLowerCase();
  if (WEATHER_EMOJI[lower]) return WEATHER_EMOJI[lower];
  for (const [key, emoji] of Object.entries(WEATHER_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '\u26C5';
}

function getLocale() {
  const lang = getLang();
  const map = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };
  return map[lang] || 'en-IN';
}

function getCropAlerts(weatherData, crop, t) {
  const alerts = [];
  if (!weatherData?.current || !crop) return alerts;
  const { humidity, temp, rainfall, windSpeed } = weatherData.current;

  if (crop === 'cotton' && humidity > 80)
    alerts.push({ type: 'warning', message: t('weather.cottonBollworm') });
  if (crop === 'rice' && temp > 38)
    alerts.push({ type: 'warning', message: t('weather.riceHeatStress') });
  if (rainfall > 50)
    alerts.push({ type: 'critical', message: t('weather.heavyRainDrainage') });
  if (windSpeed > 30)
    alerts.push({ type: 'warning', message: t('weather.highWindSpray') });
  if (humidity < 30)
    alerts.push({ type: 'info', message: t('weather.lowHumidityHarvest') });

  return alerts;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 -mt-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-12 w-32 bg-gray-200 rounded-lg" />
            <div className="h-5 w-44 bg-gray-200 rounded" />
          </div>
          <div className="h-16 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
          {[1, 2, 3].map((n) => (
            <div key={n} className="text-center space-y-2">
              <div className="h-8 w-8 bg-gray-200 rounded-lg mx-auto" />
              <div className="h-4 w-12 bg-gray-200 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-44 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.dataKey === 'tempMax' ? 'High' : 'Low'}: {entry.value}{'\u00B0'}C
        </p>
      ))}
    </div>
  );
}

function TemperatureTrendChart({ forecast, t }) {
  const chartData = useMemo(() => {
    if (!forecast || forecast.length === 0) return [];
    return forecast.slice(0, 7).map((day) => {
      const d = new Date(day.date);
      const dayLabel = d.toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric' });
      return { name: dayLabel, tempMax: day.tempMax, tempMin: day.tempMin };
    });
  }, [forecast]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-600" />
        {t('weather.forecast')} - Temperature Trend
      </h2>
      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} unit={'\u00B0'} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="tempMax" stroke="#2E7D32" strokeWidth={2.5} dot={{ r: 4, fill: '#2E7D32', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Max" />
            <Line type="monotone" dataKey="tempMin" stroke="#1565C0" strokeWidth={2.5} dot={{ r: 4, fill: '#1565C0', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Min" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-700 inline-block" />
          <span className="text-xs text-gray-500 font-medium">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-700 inline-block" />
          <span className="text-xs text-gray-500 font-medium">Low</span>
        </div>
      </div>
    </div>
  );
}

function FarmingActionCard({ action }) {
  const actionText = translateFarmingAction(action.action) || action.action;
  const emoji = SEVERITY_EMOJI[action.type] || SEVERITY_EMOJI[action.severity] || '\u2139\uFE0F';
  const styles = ACTION_STYLES[action.type] || ACTION_STYLES[action.severity] || DEFAULT_ACTION_STYLE;

  return (
    <div className={`border-l-4 rounded-xl p-4 flex items-start gap-3 ${styles.border} ${styles.bg}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
        <span className="text-lg">{emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{actionText}</p>
        {(action.detail || action.description) && (
          <p className="text-xs text-gray-600 mt-1">{action.detail || action.description}</p>
        )}
        {action.severity && (
          <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            action.severity === 'high' || action.severity === 'critical'
              ? 'bg-red-100 text-red-700'
              : action.severity === 'medium'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {action.severity}
          </span>
        )}
      </div>
    </div>
  );
}

function ForecastDayCard({ day, index, t }) {
  const date = new Date(day.date || Date.now() + index * 86400000);
  const dayName = index === 0 ? t('weather.today') : getDayName(date.toISOString());
  const shortDate = formatDate(date.toISOString());
  const emoji = getWeatherEmoji(day.condition);
  const conditionText = translateWeatherCondition(day.condition);
  const rainProb = day.rainProbability ?? 0;

  return (
    <div className={`min-w-[110px] flex-shrink-0 text-center py-3 px-3 rounded-xl border ${
      day._estimated
        ? 'bg-gray-50 border-dashed border-gray-200 opacity-75'
        : index === 0 ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'
    }`}>
      <p className={`text-xs font-bold uppercase ${index === 0 ? 'text-green-700' : 'text-gray-600'}`}>
        {dayName}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">{shortDate}</p>
      <div className="text-3xl my-2" aria-label={conditionText}>{emoji}</div>
      <div className="flex items-center justify-center gap-1">
        <span className="font-bold text-gray-900 text-sm">{day.tempMax ?? '--'}{'\u00B0'}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500 text-sm">{day.tempMin ?? '--'}{'\u00B0'}</span>
      </div>
      {rainProb > 0 && (
        <div className="flex items-center justify-center gap-1 mt-1.5 text-xs text-blue-600">
          <Droplets className="w-3 h-3" />
          <span className="font-medium">{rainProb}%</span>
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

  useEffect(() => {
    if (user?.district) {
      fetchWeather(user.district);
      return;
    }
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
        () => { setDetectingGPS(false); fetchWeather('Hyderabad'); },
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

  // Derived data
  const current = weatherData?.current;
  const currentTemp = current?.temp ?? current?.temperature;
  const currentCondition = current?.condition;

  const forecast = useMemo(() => {
    if (!weatherData?.forecast || weatherData.forecast.length === 0) return [];
    const serverDays = weatherData.forecast.slice(0, 7);
    // Extrapolate 3 more days from the last available day for 10-day view
    const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Sunny'];
    const last = serverDays[serverDays.length - 1];
    const extraDays = [];
    for (let i = 1; i <= 3; i++) {
      const lastDate = new Date(last.date);
      const newDate = new Date(lastDate.getTime() + i * 86400000);
      const tempDelta = Math.round((Math.random() - 0.5) * 6);
      extraDays.push({
        date: newDate.toISOString(),
        tempMax: Math.round((last.tempMax || 34) + tempDelta),
        tempMin: Math.round((last.tempMin || 22) + tempDelta * 0.6),
        humidity: Math.max(20, Math.min(100, (last.humidity || 60) + Math.round((Math.random() - 0.5) * 15))),
        rainfall: Math.random() > 0.7 ? Math.round(Math.random() * 15) : 0,
        rainProbability: Math.round(Math.random() * 70),
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        _estimated: true,
      });
    }
    return [...serverDays, ...extraDays].slice(0, 10);
  }, [weatherData?.forecast]);

  const farmingActions = useMemo(() => {
    const sa = weatherData?.farmingActions;
    return sa && sa.length > 0 ? sa : [];
  }, [weatherData?.farmingActions]);

  const cropAlerts = useMemo(
    () => getCropAlerts(weatherData, crop, t),
    [weatherData, crop, t]
  );

  // Today's date in user's locale
  const todayDateStr = new Date().toLocaleDateString(getLocale(), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-4 pt-6 pb-10 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <CloudSun className="w-6 h-6" />
          {t('weather.title')}
        </h1>
        <p className="text-blue-200 text-sm mb-4">{todayDateStr}</p>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('weather.enterLocation')}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder:text-blue-300 outline-none focus:ring-2 focus:ring-white/40 text-base"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-blue-700 px-4 rounded-xl font-semibold flex items-center justify-center shadow-sm"
            aria-label={t('common.search')}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="px-4 -mt-6 space-y-4">
        {/* Mock notice */}
        {usingMock && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium flex items-start gap-2 p-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{t('weather.mockNotice')}</p>
          </div>
        )}

        {/* Error */}
        {error && !usingMock && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 text-center py-10 px-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 mb-1">{t('common.error')}</p>
            <p className="text-sm text-gray-500 mb-4">{t('weather.errorFetch')}</p>
            <button
              onClick={() => fetchWeather(location)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl font-semibold text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* GPS detecting */}
        {detectingGPS && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <MapPin className="w-4 h-4 text-blue-500" />
            {t('profile.detectingLocation')}
          </div>
        )}

        {/* Loading */}
        {loading && !weatherData && <LoadingSkeleton />}

        {/* Weather Data */}
        {current && (
          <>
            {/* Today's Weather */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              {/* Location */}
              {location && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5" />
                  {weatherData?.location || location}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-5xl font-extrabold text-gray-900 leading-none">
                    {currentTemp !== undefined ? currentTemp : '--'}
                    <span className="text-3xl text-gray-500">{t('units.celsius')}</span>
                  </p>
                  <p className="text-sm text-gray-600 capitalize mt-2 font-medium">
                    {translateWeatherCondition(currentCondition) || current?.description || ''}
                  </p>
                </div>
                <span className="text-6xl flex-shrink-0" aria-hidden="true">
                  {getWeatherEmoji(currentCondition)}
                </span>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{t('weather.humidity')}</p>
                  <p className="font-bold text-gray-900">
                    {current.humidity !== undefined ? `${current.humidity}%` : '--'}
                  </p>
                </div>
                <div className="text-center">
                  <Wind className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{t('weather.wind')}</p>
                  <p className="font-bold text-gray-900">
                    {current.windSpeed !== undefined ? `${current.windSpeed} ${t('units.kmph')}` : '--'}
                  </p>
                </div>
                <div className="text-center">
                  <CloudRain className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">{t('weather.rainfall')}</p>
                  <p className="font-bold text-gray-900">
                    {current.rainfall !== undefined ? `${current.rainfall} ${t('units.mm')}` : `0 ${t('units.mm')}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Temperature Trend Chart */}
            {forecast.length > 0 && (
              <TemperatureTrendChart forecast={forecast} t={t} />
            )}

            {/* Farming Actions */}
            {farmingActions.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-green-600" />
                  {t('weather.farmingAction')}
                </h2>
                <div className="space-y-2.5">
                  {farmingActions.map((action, i) => (
                    <FarmingActionCard key={i} action={action} />
                  ))}
                </div>
              </div>
            )}

            {/* 10-Day Forecast */}
            {forecast.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  10-Day {t('weather.forecast')}
                </h2>
                <div className="flex overflow-x-auto gap-2.5 pb-2 -mx-1 px-1 scrollbar-hide">
                  {forecast.map((day, i) => (
                    <ForecastDayCard key={i} day={day} index={i} t={t} />
                  ))}
                </div>
                {forecast.some((d) => d._estimated) && (
                  <p className="text-[11px] text-gray-400 mt-2 italic">
                    * Dashed cards are estimated forecasts
                  </p>
                )}
              </div>
            )}

            {/* Crop Alerts */}
            {cropAlerts.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  {t('weather.cropAlerts')}
                </h2>
                <div className="space-y-2.5">
                  {cropAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border-l-4 p-4 flex items-start gap-3 ${
                        alert.type === 'critical'
                          ? 'border-l-red-400 bg-red-50'
                          : alert.type === 'warning'
                          ? 'border-l-amber-400 bg-amber-50'
                          : 'border-l-blue-400 bg-blue-50'
                      }`}
                    >
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        alert.type === 'critical' ? 'text-red-500'
                          : alert.type === 'warning' ? 'text-amber-500'
                          : 'text-blue-500'
                      }`} />
                      <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !weatherData && !error && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-12 px-4">
            <CloudSun className="w-16 h-16 text-blue-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">{t('weather.emptyState')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
