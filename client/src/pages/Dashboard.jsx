import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { getWeather } from '../services/weatherService';
import { getAdvisory } from '../services/advisoryService';
import { getPrices } from '../services/priceService';
import {
  translateCrop,
  translateSoil,
  translateWeatherCondition,
} from '../utils/translate';
import {
  Sprout,
  CloudSun,
  TrendingUp,
  FileText,
  Newspaper,
  Mic,
  Droplets,
  Wind,
  CloudRain,
  ArrowRight,
  Loader2,
  MapPin,
  Bell,
} from 'lucide-react';

const WEATHER_EMOJI = {
  clear: '\u2600\uFE0F',
  sunny: '\uD83C\uDF1E',
  'partly cloudy': '\u26C5',
  cloudy: '\u2601\uFE0F',
  clouds: '\u2601\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  'light rain': '\uD83C\uDF27\uFE0F',
  'moderate rain': '\uD83C\uDF27\uFE0F',
  'heavy rain': '\uD83C\uDF27\uFE0F',
  drizzle: '\uD83C\uDF27\uFE0F',
  thunderstorm: '\u26C8\uFE0F',
  haze: '\uD83C\uDF2B\uFE0F',
  mist: '\uD83C\uDF2B\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
};

function getWeatherEmoji(condition) {
  if (!condition) return '\u26C5';
  const lower = condition.toLowerCase();
  if (WEATHER_EMOJI[lower]) return WEATHER_EMOJI[lower];
  for (const [key, emoji] of Object.entries(WEATHER_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '\u26C5';
}

const QUICK_ACTIONS = [
  { key: 'advisory', icon: Sprout, route: '/advisory', gradient: 'from-green-500 to-emerald-600' },
  { key: 'weather', icon: CloudSun, route: '/weather', gradient: 'from-blue-500 to-cyan-600' },
  { key: 'prices', icon: TrendingUp, route: '/prices', gradient: 'from-amber-500 to-orange-600' },
  { key: 'schemes', icon: FileText, route: '/schemes', gradient: 'from-purple-500 to-violet-600' },
  { key: 'news', icon: Newspaper, route: '/news', gradient: 'from-rose-500 to-pink-600' },
  { key: 'chatbot', icon: Mic, route: '/chatbot', gradient: 'from-indigo-500 to-blue-600' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, selectedCrop, soilType, season } = useFarm();

  const [weatherData, setWeatherData] = useState(null);
  const [advisoryData, setAdvisoryData] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectedLocation, setDetectedLocation] = useState('');

  // Auto-detect location via browser geolocation
  useEffect(() => {
    if (user?.district) {
      setDetectedLocation(user.district);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const resp = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await resp.json();
            const loc = data.city || data.locality || data.principalSubdivision || 'Hyderabad';
            setDetectedLocation(loc);
          } catch {
            setDetectedLocation('Hyderabad');
          }
        },
        () => setDetectedLocation('Hyderabad'),
        { timeout: 5000 }
      );
    } else {
      setDetectedLocation('Hyderabad');
    }
  }, [user?.district]);

  // Fetch dashboard data once location is available
  useEffect(() => {
    if (!detectedLocation) return;
    let cancelled = false;

    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const crop = user?.primaryCrop || selectedCrop || 'cotton';

        const promises = [
          getWeather(detectedLocation).catch(() => null),
          crop && soilType
            ? getAdvisory({ crop, soilType, season }).catch(() => null)
            : Promise.resolve(null),
          getPrices({ crop, state: user?.state }).catch(() => null),
        ];

        const [weatherResp, advisoryResp, pricesResp] = await Promise.all(promises);
        if (!cancelled) {
          setWeatherData(weatherResp?.data || weatherResp || null);
          setAdvisoryData(advisoryResp?.data || advisoryResp || null);
          setPriceData(pricesResp?.data || pricesResp || null);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDashboard();
    return () => { cancelled = true; };
  }, [detectedLocation, user, selectedCrop, soilType, season]);

  const userName = user?.name?.split(' ')[0] || '';
  const currentTemp = weatherData?.current?.temp ?? weatherData?.current?.temperature;
  const currentCondition = weatherData?.current?.condition;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-primary-800 via-green-700 to-emerald-800 text-white px-4 pt-8 pb-16 rounded-b-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <p className="text-green-200 text-sm font-medium">{t('app.tagline')}</p>
          <h1 className="text-2xl font-bold mt-1">
            {t('dashboard.welcome')}{userName ? `, ${userName}` : ''}! {'\uD83C\uDF3E'}
          </h1>
          {detectedLocation && (
            <p className="text-green-200 text-sm mt-2 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {detectedLocation}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">
        {/* Weather Card - Full Width Hero */}
        <div
          className="rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white p-5 shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => navigate('/weather')}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-100 flex items-center gap-1.5">
              <CloudSun className="w-4 h-4" />
              {t('dashboard.todayWeather')}
            </h2>
            <ArrowRight className="w-4 h-4 text-blue-200" />
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-200" />
              <span className="text-blue-100">{t('common.loading')}</span>
            </div>
          ) : currentTemp !== undefined ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-bold leading-none">
                  {currentTemp}°
                </p>
                <p className="text-blue-100 mt-1 capitalize text-sm">
                  {translateWeatherCondition(currentCondition)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-5xl">{getWeatherEmoji(currentCondition)}</span>
                <div className="flex items-center gap-3 mt-2 text-xs text-blue-100">
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    {weatherData.current.humidity}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5" />
                    {weatherData.current.windSpeed} km/h
                  </span>
                  {weatherData.current.rainfall > 0 && (
                    <span className="flex items-center gap-1">
                      <CloudRain className="w-3.5 h-3.5" />
                      {weatherData.current.rainfall}mm
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-blue-100 text-sm py-2">{t('common.noData')}</p>
          )}
        </div>

        {/* Two-Column: Crop + Market */}
        <div className="grid grid-cols-2 gap-3">
          {/* Crop Status */}
          <div
            className="card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate('/advisory')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Sprout className="w-4 h-4 text-green-700" />
              </div>
              <h2 className="text-xs font-bold text-gray-500 uppercase">
                {t('dashboard.cropStatus')}
              </h2>
            </div>

            {loading ? (
              <div className="skeleton h-4 w-16 mt-1" />
            ) : (
              <div>
                <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                  {translateCrop(user?.primaryCrop || selectedCrop || 'cotton')}
                </span>
                {(user?.soilType || soilType) && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    {translateSoil(user?.soilType || soilType)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Market Price */}
          <div
            className="card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate('/prices')}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-700" />
              </div>
              <h2 className="text-xs font-bold text-gray-500 uppercase">
                {t('dashboard.marketUpdate')}
              </h2>
            </div>

            {loading ? (
              <div className="skeleton h-5 w-20 mt-1" />
            ) : priceData?.prices?.length > 0 ? (
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {'\u20B9'}{priceData.prices[0].modal_price || priceData.prices[0].price}
                </p>
                <p className="text-[11px] text-gray-500">
                  {t('prices.perQuintal')}
                </p>
              </div>
            ) : (
              <p className="text-gray-400 text-xs mt-1">{t('common.noData')}</p>
            )}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div>
          <h2 className="section-title mb-3">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-3 gap-3">
            {QUICK_ACTIONS.map(({ key, icon: Icon, route, gradient }) => (
              <button
                key={key}
                onClick={() => navigate(route)}
                className="flex flex-col items-center p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-95 min-h-touch"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-800 text-xs text-center leading-tight">
                  {t(`nav.${key}`)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
