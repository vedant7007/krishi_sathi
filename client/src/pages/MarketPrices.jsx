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
  AlertTriangle,
  Shield,
  Scale,
  Rocket,
  Warehouse,
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

function ConfidenceDots({ level = 'medium' }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  const color = level === 'high' ? 'bg-green-500' : level === 'medium' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full ${i <= filled ? color : 'bg-gray-200'}`} />
      ))}
    </div>
  );
}

/**
 * Analyze market data and return probability-based recommendation
 * with strategy modes instead of binary sell/hold.
 */
function analyzeMarket({ topPrice, msp, chartData, historyStats, t }) {
  const analysis = {
    trendDirection: 'stable',
    trendProbability: 50,
    confidence: 'medium',
    priceRangeLow: topPrice,
    priceRangeHigh: topPrice,
    reasons: [],
    strategies: [],
  };

  // --- Trend detection from chart data ---
  if (chartData && chartData.length >= 3) {
    const prices = chartData.map((d) => d.price).filter(Boolean);
    if (prices.length >= 3) {
      const recent3 = prices.slice(-3);
      const recent7 = prices.slice(-7);
      const avgRecent3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
      const avgAll = prices.reduce((a, b) => a + b, 0) / prices.length;
      const diff = avgRecent3 - avgAll;
      const pctChange = ((diff / avgAll) * 100);

      if (pctChange > 3) {
        analysis.trendDirection = 'rising';
        analysis.trendProbability = Math.min(85, 55 + Math.round(pctChange * 3));
      } else if (pctChange < -3) {
        analysis.trendDirection = 'falling';
        analysis.trendProbability = Math.min(85, 55 + Math.round(Math.abs(pctChange) * 3));
      } else {
        analysis.trendDirection = 'stable';
        analysis.trendProbability = 45 + Math.round(Math.random() * 10);
      }

      // Confidence from data amount
      analysis.confidence = prices.length >= 10 ? 'high' : prices.length >= 5 ? 'medium' : 'low';

      // 7-day price range estimation
      const volatility = Math.max(...prices) - Math.min(...prices);
      const halfSwing = Math.round(volatility * 0.4);
      analysis.priceRangeLow = Math.round(topPrice - halfSwing);
      analysis.priceRangeHigh = Math.round(topPrice + halfSwing);
    }
  }

  // --- Reasons ---
  if (msp) {
    const mspDiff = (((topPrice - msp) / msp) * 100).toFixed(0);
    if (topPrice > msp) {
      analysis.reasons.push(t('prices.reason_aboveMsp', { pct: mspDiff, msp, defaultValue: `Current price is ${mspDiff}% above MSP (₹${msp})` }));
    } else {
      analysis.reasons.push(t('prices.reason_belowMsp', { pct: Math.abs(mspDiff), msp, defaultValue: `Current price is ${Math.abs(mspDiff)}% below MSP (₹${msp})` }));
    }
  }

  if (analysis.trendDirection === 'falling') {
    analysis.reasons.push(
      t('prices.reason_falling', {
        pct: analysis.trendProbability,
        defaultValue: `Based on 14-day trend, prices show a ${analysis.trendProbability}% probability of further decline`,
      })
    );
  } else if (analysis.trendDirection === 'rising') {
    analysis.reasons.push(
      t('prices.reason_rising', {
        pct: analysis.trendProbability,
        defaultValue: `Based on 14-day trend, prices show a ${analysis.trendProbability}% probability of continued increase`,
      })
    );
  } else {
    analysis.reasons.push(t('prices.reason_stable', 'Market is relatively stable with no strong directional signal'));
  }

  if (historyStats?.avg) {
    const avg = Math.round(historyStats.avg);
    analysis.reasons.push(t('prices.reason_avg', { avg, defaultValue: `14-day average price: ₹${avg}/quintal` }));
  }

  // --- Strategy modes ---
  const isFalling = analysis.trendDirection === 'falling';
  const isRising = analysis.trendDirection === 'rising';
  const aboveMsp = msp ? topPrice > msp : true;

  // Conservative
  analysis.strategies.push({
    mode: 'conservative',
    icon: Shield,
    label: t('prices.strategy_conservative', 'Conservative'),
    action: isFalling || !aboveMsp
      ? t('prices.strategy_conservative_sell', 'Sell now to lock in current price and reduce risk')
      : t('prices.strategy_conservative_partial', 'Sell 70-80% now, keep 20-30% for upside'),
    expected: `₹${analysis.priceRangeLow} – ₹${topPrice}`,
    highlight: isFalling,
  });

  // Balanced
  analysis.strategies.push({
    mode: 'balanced',
    icon: Scale,
    label: t('prices.strategy_balanced', 'Balanced'),
    action: t('prices.strategy_balanced_action', 'Sell 50% at current price, store remaining 50%'),
    expected: `₹${analysis.priceRangeLow} – ₹${analysis.priceRangeHigh}`,
    highlight: !isFalling && !isRising,
  });

  // Aggressive
  analysis.strategies.push({
    mode: 'aggressive',
    icon: Rocket,
    label: t('prices.strategy_aggressive', 'Aggressive'),
    action: isRising
      ? t('prices.strategy_aggressive_hold', 'Hold fully — prices trending up, potential rebound')
      : t('prices.strategy_aggressive_wait', 'Hold and wait for better prices (higher risk)'),
    expected: `₹${Math.round(analysis.priceRangeLow * 0.95)} – ₹${Math.round(analysis.priceRangeHigh * 1.05)}`,
    highlight: isRising,
  });

  return analysis;
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

            {/* Smart Market Analysis — Probability-based with Strategy Modes */}
            {prices.length > 0 && (() => {
              const topPrice = Number(prices[0]?.modal_price || prices[0]?.price || 0);
              const msp = mspPrice || MSP_MAP[crop];
              const analysis = analyzeMarket({ topPrice, msp, chartData, historyStats, t });
              const trendColor = analysis.trendDirection === 'rising' ? 'text-green-700' : analysis.trendDirection === 'falling' ? 'text-red-600' : 'text-amber-600';
              const trendBg = analysis.trendDirection === 'rising' ? 'bg-green-100' : analysis.trendDirection === 'falling' ? 'bg-red-100' : 'bg-amber-100';
              const TrendIcn = analysis.trendDirection === 'rising' ? ArrowUpRight : analysis.trendDirection === 'falling' ? ArrowDownRight : Minus;

              return (
                <div className="card border-2 border-gray-200 space-y-4">
                  {/* Header */}
                  <h2 className="section-title flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary-800" />
                    {t('prices.marketAnalysis', 'Market Analysis')}
                  </h2>

                  {/* Trend + Confidence + Range */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-xl p-3 text-center ${trendBg}`}>
                      <TrendIcn className={`w-5 h-5 mx-auto mb-1 ${trendColor}`} />
                      <p className={`text-sm font-bold capitalize ${trendColor}`}>
                        {t(`prices.trend_${analysis.trendDirection}`, analysis.trendDirection)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{t('prices.trend', 'Trend')}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center bg-gray-50">
                      <div className="flex justify-center mb-1">
                        <ConfidenceDots level={analysis.confidence} />
                      </div>
                      <p className="text-sm font-bold text-gray-800 capitalize">{t(`prices.conf_${analysis.confidence}`, analysis.confidence)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{t('prices.confidence', 'Confidence')}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center bg-blue-50">
                      <p className="text-sm font-bold text-blue-800">{'\u20B9'}{analysis.priceRangeLow}</p>
                      <p className="text-[10px] text-blue-600">–</p>
                      <p className="text-sm font-bold text-blue-800">{'\u20B9'}{analysis.priceRangeHigh}</p>
                      <p className="text-[10px] text-gray-500">{t('prices.range7d', '7-day est.')}</p>
                    </div>
                  </div>

                  {/* Probability Statement */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {analysis.trendDirection === 'falling'
                        ? t('prices.prob_falling', { pct: analysis.trendProbability, defaultValue: `Based on 14-day trend data, prices show a ${analysis.trendProbability}% probability of further decline.` })
                        : analysis.trendDirection === 'rising'
                        ? t('prices.prob_rising', { pct: analysis.trendProbability, defaultValue: `Based on 14-day trend data, prices show a ${analysis.trendProbability}% probability of continued increase.` })
                        : t('prices.prob_stable', 'Market shows no strong directional signal. Prices are relatively stable.')}
                    </p>
                  </div>

                  {/* Data Points */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-500">{t('prices.bestPrice', 'Best Price')}</span>
                      <span className="font-bold text-gray-900">{'\u20B9'}{topPrice}</span>
                    </div>
                    {msp && (
                      <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-500">MSP</span>
                        <span className="font-bold text-gray-900">{'\u20B9'}{msp}</span>
                      </div>
                    )}
                    {msp && (
                      <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-500">{t('prices.vsMsp', 'vs MSP')}</span>
                        <span className={`font-bold ${topPrice >= msp ? 'text-green-700' : 'text-red-600'}`}>
                          {topPrice >= msp ? '+' : ''}{(((topPrice - msp) / msp) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Analysis Reasons */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('prices.analysisPoints', 'Analysis')}</p>
                    <ul className="space-y-1.5">
                      {analysis.reasons.map((reason, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-800 flex-shrink-0" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Strategy Modes */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('prices.strategyOptions', 'Strategy Options')}</p>
                    <div className="space-y-2">
                      {analysis.strategies.map((s) => {
                        const SIcon = s.icon;
                        return (
                          <div
                            key={s.mode}
                            className={`rounded-xl border-2 p-3 transition-all ${
                              s.highlight
                                ? 'border-primary-400 bg-primary-50'
                                : 'border-gray-100 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <SIcon className={`w-4 h-4 flex-shrink-0 ${s.highlight ? 'text-primary-800' : 'text-gray-500'}`} />
                              <span className="text-sm font-bold text-gray-900">{s.label}</span>
                              {s.highlight && (
                                <span className="text-[10px] bg-primary-200 text-primary-900 px-1.5 py-0.5 rounded-full font-semibold">
                                  {t('prices.recommended', 'Recommended')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{s.action}</p>
                            <p className="text-xs text-gray-400">{t('prices.expectedRange', 'Expected')}: {s.expected}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Storage Cost Hint */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                    <Warehouse className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">{t('prices.storageTip', 'Storage Tip')}</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {t('prices.storageHint', 'If holding, factor in storage cost (~₹15-25/quintal/day). Holding for 7 days adds ₹105-175 to your cost basis.')}
                      </p>
                    </div>
                  </div>

                  {/* Risk Warning */}
                  <div className="bg-gray-100 rounded-lg p-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {t('prices.riskWarning', 'Market predictions are probabilistic. Unexpected policy changes, weather events, or supply disruptions may impact actual prices. This analysis is for informational purposes only.')}
                    </p>
                  </div>

                  <p className="text-[10px] text-gray-400 text-right">
                    {t('prices.basedOn', 'Based on 14-day historical data & MSP comparison')}
                  </p>
                </div>
              );
            })()}

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
