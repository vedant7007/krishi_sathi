import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { getPrices, getPriceHistory, getSellRecommendation } from '../services/priceService';
import { translateCrop, translateSoil, translateState, formatDate, getLang } from '../utils/translate';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  MapPin,
  IndianRupee,
  ShoppingCart,
  BarChart3,
  PackageSearch,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// All 40 crops
const CROP_OPTIONS = [
  'cotton', 'rice', 'wheat', 'maize', 'tomato', 'groundnut', 'soybean',
  'sugarcane', 'onion', 'chilli', 'potato', 'mustard', 'jowar', 'bajra',
  'ragi', 'turmeric', 'ginger', 'garlic', 'brinjal', 'cabbage',
  'cauliflower', 'peas', 'lentil', 'chickpea', 'pigeon_pea', 'green_gram',
  'black_gram', 'sesame', 'sunflower', 'jute', 'tea', 'coffee', 'coconut',
  'banana', 'mango', 'papaya', 'guava', 'pomegranate', 'grape', 'watermelon',
];

// All 36 States/UTs
const STATE_OPTIONS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// MSP reference prices (Rs per quintal) for major crops - 2024-25 Kharif/Rabi
const MSP_MAP = {
  rice: 2300, wheat: 2275, maize: 2090, jowar: 3180, bajra: 2500,
  ragi: 3846, cotton: 7121, groundnut: 6377, soybean: 4892,
  sugarcane: 3150, mustard: 5650, lentil: 6425, chickpea: 5440,
  pigeon_pea: 7000, green_gram: 8558, black_gram: 6950,
  sesame: 8635, sunflower: 6760, jute: 5050,
};

function TrendIcon({ trend, todayPrice, yesterdayPrice }) {
  if (todayPrice !== undefined && yesterdayPrice !== undefined && yesterdayPrice > 0) {
    const diff = todayPrice - yesterdayPrice;
    const percent = ((diff / yesterdayPrice) * 100).toFixed(1);
    if (diff > 0) {
      return (
        <div className="flex items-center gap-1 text-primary-800">
          <ArrowUpRight className="w-4 h-4" />
          <span className="text-xs font-semibold">+{percent}%</span>
        </div>
      );
    }
    if (diff < 0) {
      return (
        <div className="flex items-center gap-1 text-alert-red">
          <ArrowDownRight className="w-4 h-4" />
          <span className="text-xs font-semibold">{percent}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Minus className="w-4 h-4" />
        <span className="text-xs font-semibold">0%</span>
      </div>
    );
  }

  if (!trend) return <Minus className="w-4 h-4 text-gray-400" />;
  const lower = typeof trend === 'string' ? trend.toLowerCase() : '';
  if (lower === 'rising' || lower === 'up' || trend > 0)
    return <ArrowUpRight className="w-4 h-4 text-primary-800" />;
  if (lower === 'falling' || lower === 'down' || trend < 0)
    return <ArrowDownRight className="w-4 h-4 text-alert-red" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function TrendArrow({ trend }) {
  if (!trend) return <span className="text-gray-400">&rarr;</span>;
  const lower = typeof trend === 'string' ? trend.toLowerCase() : '';
  if (lower === 'rising' || lower === 'up' || trend > 0)
    return <span className="text-primary-800 font-bold">&uarr;</span>;
  if (lower === 'falling' || lower === 'down' || trend < 0)
    return <span className="text-alert-red font-bold">&darr;</span>;
  return <span className="text-gray-400">&rarr;</span>;
}

function SellScore({ score, maxScore = 4 }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxScore }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${
            i < score ? 'bg-primary-800' : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="text-xs text-gray-500 ml-1">{score}/{maxScore}</span>
    </div>
  );
}

function EmptyPriceState({ t }) {
  return (
    <div className="card text-center py-10">
      <PackageSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        {t('prices.noPricesFound')}
      </h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto">
        {t('prices.noPricesDescription')}
      </p>
    </div>
  );
}

export default function MarketPrices() {
  const { t } = useTranslation();
  const { user } = useFarm();

  const [crop, setCrop] = useState(user?.primaryCrop || 'cotton');
  const [state, setState] = useState(user?.state || '');
  const [prices, setPrices] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState(null);
  const [mspPrice, setMspPrice] = useState(null);
  const [sellRec, setSellRec] = useState(null);
  const [selectedMandi, setSelectedMandi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch prices + initial sell recommendation
  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSelectedMandi(null);
    try {
      const [priceResponse, recResponse] = await Promise.all([
        getPrices(crop, state).catch(() => null),
        getSellRecommendation(crop, state).catch(() => null),
      ]);

      // After .then(res => res.data): { success, data: { prices: [...] } }
      const priceData = priceResponse?.data || priceResponse;
      const recData = recResponse?.data || recResponse;

      const priceList = priceData?.prices || [];
      // Sort by highest price first
      priceList.sort((a, b) => {
        const pa = Number(a.modal_price || a.price || 0);
        const pb = Number(b.modal_price || b.price || 0);
        return pb - pa;
      });
      setPrices(priceList);

      // Set MSP from hardcoded map or API
      setMspPrice(priceData?.mspPrice || MSP_MAP[crop] || null);

      setSellRec(recData);

      // If we have prices, fetch history for the first mandi
      if (priceList.length > 0) {
        const firstMandi = priceList[0].mandi || priceList[0].market;
        if (firstMandi) {
          setSelectedMandi(firstMandi);
          fetchHistory(firstMandi);
        }
      } else {
        setHistory([]);
        setHistoryStats(null);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch price history for a specific mandi
  const fetchHistory = async (mandi) => {
    try {
      const historyResponse = await getPriceHistory(crop, mandi, 14).catch(() => null);
      // After .then(res => res.data): { success, data: { history: [...], stats: { avg, min, max } } }
      const historyData = historyResponse?.data || historyResponse;
      setHistory(historyData?.history || []);
      setHistoryStats(historyData?.stats || null);
    } catch {
      setHistory([]);
      setHistoryStats(null);
    }
  };

  const handleMandiClick = (mandiName) => {
    setSelectedMandi(mandiName);
    fetchHistory(mandiName);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, state]);

  // Format chart data with locale-aware dates
  const chartData = history.map((item) => ({
    date: item.date ? formatDate(item.date, { weekday: undefined, month: 'short', day: 'numeric' }) : '',
    rawDate: item.date,
    price: Number(item.modal_price || item.price || 0),
    minPrice: Number(item.minPrice || item.min_price || item.min || 0),
    maxPrice: Number(item.maxPrice || item.max_price || item.max || 0),
  }));

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-accent-700 to-accent-800 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6" />
          {t('prices.title')}
        </h1>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="flex-1 px-3 py-3 rounded-lg bg-white/10 border border-white/20 text-white outline-none min-h-touch"
          >
            {CROP_OPTIONS.map((c) => (
              <option key={c} value={c} className="text-gray-900">
                {translateCrop(c)}
              </option>
            ))}
          </select>

          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="flex-1 px-3 py-3 rounded-lg bg-white/10 border border-white/20 text-white outline-none min-h-touch"
          >
            <option value="" className="text-gray-900">
              {t('prices.allStates')}
            </option>
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s} className="text-gray-900">
                {translateState(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {error && (
          <div className="card border-red-200 bg-red-50 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="card">
              <div className="skeleton h-48 w-full" />
            </div>
            <div className="card">
              <div className="skeleton h-32 w-full" />
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* Price Insight Card */}
            {prices.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="card text-center py-3">
                  <p className="text-xs text-gray-500 mb-1">{t('prices.price')}</p>
                  <p className="text-lg font-bold text-gray-900">
                    {'\u20B9'}{prices[0]?.modal_price || prices[0]?.price || '--'}
                  </p>
                  <p className="text-[10px] text-gray-400">{t('prices.perQuintal')}</p>
                </div>
                <div className="card text-center py-3">
                  <p className="text-xs text-gray-500 mb-1">MSP</p>
                  <p className={`text-lg font-bold ${mspPrice ? 'text-gray-900' : 'text-gray-400'}`}>
                    {mspPrice ? `\u20B9${mspPrice}` : '--'}
                  </p>
                  <p className="text-[10px] text-gray-400">{t('prices.perQuintal')}</p>
                </div>
                <div className="card text-center py-3">
                  <p className="text-xs text-gray-500 mb-1">{t('prices.trend')}</p>
                  {mspPrice && prices[0] ? (() => {
                    const topPrice = Number(prices[0].modal_price || prices[0].price || 0);
                    const diff = topPrice - mspPrice;
                    const pct = ((diff / mspPrice) * 100).toFixed(0);
                    return (
                      <>
                        <p className={`text-lg font-bold ${diff >= 0 ? 'text-primary-800' : 'text-alert-red'}`}>
                          {diff >= 0 ? '+' : ''}{pct}%
                        </p>
                        <p className="text-[10px] text-gray-400">{diff >= 0 ? t('prices.rising') : t('prices.falling')}</p>
                      </>
                    );
                  })() : (
                    <p className="text-lg font-bold text-gray-400">--</p>
                  )}
                </div>
              </div>
            )}

            {/* Live Prices Table */}
            <div className="card">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-800" />
                {t('prices.livePrices')}
              </h2>

              {prices.length > 0 ? (
                <>
                  <p className="text-xs text-gray-400 mb-2">
                    {t('prices.clickMandiForHistory')}
                  </p>
                  <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-semibold text-gray-600">
                            {t('prices.mandi')}
                          </th>
                          <th className="text-right py-2 font-semibold text-gray-600">
                            {t('prices.price')}
                          </th>
                          <th className="text-right py-2 font-semibold text-gray-600">
                            {t('prices.min')}
                          </th>
                          <th className="text-right py-2 font-semibold text-gray-600">
                            {t('prices.max')}
                          </th>
                          <th className="text-right py-2 font-semibold text-gray-600">
                            {t('prices.trend')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {prices.map((item, i) => {
                          const mandiName = item.mandi || item.market;
                          const isSelected = mandiName === selectedMandi;
                          return (
                            <tr
                              key={i}
                              onClick={() => handleMandiClick(mandiName)}
                              className={`border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-primary-50 border-primary-200'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <td className="py-3 font-medium text-gray-900">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-gray-400" />
                                  {mandiName}
                                </div>
                                {item.district && (
                                  <p className="text-xs text-gray-400">{item.district}</p>
                                )}
                              </td>
                              <td className="py-3 text-right font-bold text-gray-900">
                                {'\u20B9'}{item.modal_price || item.price}
                              </td>
                              <td className="py-3 text-right text-gray-600">
                                {'\u20B9'}{item.minPrice || item.min_price || item.min || '--'}
                              </td>
                              <td className="py-3 text-right text-gray-600">
                                {'\u20B9'}{item.maxPrice || item.max_price || item.max || '--'}
                              </td>
                              <td className="py-3 text-right">
                                <TrendIcon
                                  trend={item.trend}
                                  todayPrice={Number(item.modal_price || item.price || 0)}
                                  yesterdayPrice={Number(item.prev_price || item.previousPrice || 0)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {t('units.perQuintal')}
                    </p>
                  </div>
                </>
              ) : (
                <EmptyPriceState t={t} />
              )}
            </div>

            {/* Price History Chart */}
            {chartData.length > 0 && (
              <div className="card">
                <h2 className="section-title mb-1">
                  {t('prices.priceHistory')}
                </h2>
                {selectedMandi && (
                  <p className="text-xs text-gray-500 mb-3">
                    {selectedMandi}
                  </p>
                )}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="#9CA3AF"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#9CA3AF"
                        tickFormatter={(v) => `\u20B9${v}`}
                        domain={['dataMin - 100', 'dataMax + 100']}
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          const labels = {
                            price: t('prices.price'),
                            minPrice: t('prices.min'),
                            maxPrice: t('prices.max'),
                          };
                          return [`\u20B9${value}`, labels[name] || name];
                        }}
                        labelFormatter={(label) => label}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#2E7D32"
                        strokeWidth={2}
                        dot={{ fill: '#2E7D32', r: 3 }}
                        activeDot={{ r: 5 }}
                        name="price"
                      />
                      {mspPrice && (
                        <ReferenceLine
                          y={mspPrice}
                          stroke="#D32F2F"
                          strokeDasharray="5 5"
                          strokeWidth={1.5}
                          label={{
                            value: `${t('prices.mspLine')} \u20B9${mspPrice}`,
                            position: 'insideTopRight',
                            fill: '#D32F2F',
                            fontSize: 11,
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Sell Recommendation */}
            {sellRec && (
              <div
                className={`card border-2 ${
                  sellRec.shouldSell
                    ? 'border-primary-500 bg-green-50'
                    : 'border-accent-400 bg-accent-50'
                }`}
              >
                <h2 className="section-title mb-2 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  {t('prices.sellRecommendation')}
                </h2>

                <div className="flex items-center justify-between mb-3">
                  {/* shouldSell badge */}
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                      sellRec.shouldSell
                        ? 'bg-green-200 text-green-900'
                        : 'bg-yellow-200 text-yellow-900'
                    }`}
                  >
                    {sellRec.shouldSell
                      ? t('prices.sellNow')
                      : t('prices.holdAdvice')}
                  </span>
                  <SellScore
                    score={sellRec.score ?? 2}
                    maxScore={4}
                  />
                </div>

                {sellRec.recommendation && (
                  <p className="text-sm text-gray-700 mb-3 bg-white/60 rounded-lg p-2">
                    {sellRec.recommendation}
                  </p>
                )}

                {(sellRec.currentPrice || sellRec.avg7d) && (
                  <div className="flex items-center gap-4 mb-3">
                    {sellRec.currentPrice && (
                      <div>
                        <p className="text-xs text-gray-500">{t('prices.currentPrice')}</p>
                        <p className="font-bold text-gray-900">{'\u20B9'}{sellRec.currentPrice}</p>
                      </div>
                    )}
                    {sellRec.avg7d && (
                      <div>
                        <p className="text-xs text-gray-500">{t('prices.weekAvg')}</p>
                        <p className="font-bold text-gray-900">{'\u20B9'}{sellRec.avg7d}</p>
                      </div>
                    )}
                  </div>
                )}

                {sellRec.reasons && sellRec.reasons.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      {t('prices.reasons')}
                    </p>
                    <ul className="space-y-1">
                      {sellRec.reasons.map((reason, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-700 flex items-start gap-2"
                        >
                          <span className="text-gray-400 mt-1">&#8226;</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Nearby Mandis Comparison */}
            {prices.length > 1 && (
              <div className="card">
                <h2 className="section-title mb-3">
                  {t('prices.nearbyMandis')}
                </h2>
                <div className="space-y-2">
                  {prices.slice(0, 8).map((mandi, i) => {
                    const mandiName = mandi.mandi || mandi.market;
                    const isSelected = mandiName === selectedMandi;
                    return (
                      <div
                        key={i}
                        onClick={() => handleMandiClick(mandiName)}
                        className={`flex items-center justify-between py-2 px-2 rounded-lg border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {mandiName}
                            </p>
                            {mandi.distance && (
                              <p className="text-xs text-gray-500">
                                {mandi.distance} km
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-gray-900">
                            {'\u20B9'}{mandi.modal_price || mandi.price}
                          </p>
                          <TrendArrow trend={mandi.trend} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">
                  {t('units.perQuintal')}
                </p>
              </div>
            )}

            {/* Empty state when no data at all */}
            {prices.length === 0 && chartData.length === 0 && !sellRec && !error && (
              <EmptyPriceState t={t} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
