import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import {
  getStats,
  getAdvisoryRules,
  createAdvisoryRule,
  getMarketPrices,
  createMarketPrice,
  getSchemes,
  createScheme,
  getNewsItems,
  createNewsItem,
} from '../services/adminService';
import {
  LayoutDashboard,
  Users,
  Sprout,
  TrendingUp,
  FileText,
  Newspaper,
  AlertTriangle,
  Plus,
  Loader2,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

const TABS = [
  { key: 'rules', label: 'Advisory Rules', icon: Sprout },
  { key: 'prices', label: 'Market Prices', icon: TrendingUp },
  { key: 'schemes', label: 'Schemes', icon: FileText },
  { key: 'news', label: 'News', icon: Newspaper },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card text-center">
      <div
        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${color} mx-auto mb-2`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '--'}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function DataTable({ columns, data, onRefresh, refreshing }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex justify-end mb-2">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-sm text-primary-800 font-semibold flex items-center gap-1 min-h-touch"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-2 px-2 font-semibold text-gray-600 whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row._id || row.id || i}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-2.5 px-2 text-gray-800">
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key] ?? '--')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddModal({ title, fields, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.key]: f.defaultValue || '' }), {})
  );

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg min-h-touch min-w-touch flex items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                  required={field.required}
                />
              ) : field.type === 'select' ? (
                <select
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="input-field"
                  required={field.required}
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="input-field"
                  required={field.required}
                />
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Field definitions for the Add modals
const RULE_FIELDS = [
  {
    key: 'crop',
    label: 'Crop',
    type: 'select',
    required: true,
    options: [
      'cotton',
      'rice',
      'wheat',
      'maize',
      'tomato',
      'groundnut',
      'soybean',
      'sugarcane',
      'onion',
      'chilli',
    ],
  },
  {
    key: 'soilType',
    label: 'Soil Type',
    type: 'select',
    required: true,
    options: ['black', 'red', 'alluvial', 'laterite', 'sandy', 'clay', 'loamy'],
  },
  {
    key: 'season',
    label: 'Season',
    type: 'select',
    required: true,
    options: ['kharif', 'rabi', 'zaid'],
  },
  { key: 'fertilizerRecommendation', label: 'Fertilizer Recommendation', type: 'textarea' },
  { key: 'irrigationMethod', label: 'Irrigation Method', type: 'text' },
  { key: 'pestControl', label: 'Pest Control', type: 'textarea' },
  { key: 'mspPrice', label: 'MSP Price', type: 'number' },
];

const PRICE_FIELDS = [
  {
    key: 'crop',
    label: 'Crop',
    type: 'select',
    required: true,
    options: [
      'cotton',
      'rice',
      'wheat',
      'maize',
      'tomato',
      'groundnut',
      'soybean',
      'sugarcane',
      'onion',
      'chilli',
    ],
  },
  { key: 'mandi', label: 'Mandi Name', type: 'text', required: true },
  { key: 'state', label: 'State', type: 'text', required: true },
  { key: 'modal_price', label: 'Modal Price', type: 'number', required: true },
  { key: 'min_price', label: 'Min Price', type: 'number' },
  { key: 'max_price', label: 'Max Price', type: 'number' },
];

const SCHEME_FIELDS = [
  { key: 'name', label: 'Scheme Name', type: 'text', required: true },
  { key: 'shortName', label: 'Short Name', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea', required: true },
  { key: 'benefits', label: 'Benefits', type: 'textarea' },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: ['subsidy', 'insurance', 'credit', 'infrastructure', 'training'],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: ['active', 'upcoming', 'closed'],
    defaultValue: 'active',
  },
];

const NEWS_FIELDS = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true },
  { key: 'content', label: 'Full Content', type: 'textarea' },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    options: ['weather', 'market', 'policy', 'technology', 'advisory', 'schemes'],
  },
  { key: 'source', label: 'Source', type: 'text' },
];

export default function AdminPanel() {
  const { t } = useTranslation();
  const { user } = useFarm();

  const [activeTab, setActiveTab] = useState('rules');
  const [stats, setStats] = useState(null);
  const [tabData, setTabData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch stats — API returns { success, data: { users: {...}, cropRules, ... } }
  useEffect(() => {
    getStats()
      .then((res) => setStats(res?.data || res))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load admin stats'));
  }, []);

  // Fetch tab data
  const fetchTabData = async () => {
    const setLoad = tabData.length === 0 ? setLoading : setRefreshing;
    setLoad(true);
    setError('');
    try {
      let data;
      switch (activeTab) {
        case 'rules':
          data = await getAdvisoryRules();
          break;
        case 'prices':
          data = await getMarketPrices();
          break;
        case 'schemes':
          data = await getSchemes();
          break;
        case 'news':
          data = await getNewsItems();
          break;
        default:
          data = [];
      }
      // Extract array from nested API response: { success, data: { cropRules: [...] } }
      const inner = data?.data || data;
      const arr = Array.isArray(inner)
        ? inner
        : inner?.cropRules || inner?.rules || inner?.prices || inner?.schemes || inner?.news || inner?.articles || [];
      setTabData(Array.isArray(arr) ? arr : []);
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setTabData([]);
    fetchTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Redirect non-admin users (AFTER all hooks to avoid hooks violation)
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Handle add new
  const handleAddNew = async (formData) => {
    setSaving(true);
    setError('');
    try {
      switch (activeTab) {
        case 'rules':
          await createAdvisoryRule(formData);
          break;
        case 'prices':
          await createMarketPrice(formData);
          break;
        case 'schemes':
          await createScheme(formData);
          break;
        case 'news':
          await createNewsItem(formData);
          break;
      }
      setShowModal(false);
      fetchTabData();
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // Column definitions per tab
  const columnMap = {
    rules: [
      { key: 'crop', label: 'Crop', render: (v) => v?.charAt(0).toUpperCase() + v?.slice(1) },
      { key: 'soilType', label: 'Soil' },
      { key: 'season', label: 'Season' },
      { key: 'mspPrice', label: 'MSP', render: (v) => (v ? `\u20B9${v}` : '--') },
    ],
    prices: [
      { key: 'crop', label: 'Crop' },
      { key: 'mandi', label: 'Mandi' },
      { key: 'state', label: 'State' },
      { key: 'modal_price', label: 'Price', render: (v) => (v ? `\u20B9${v}` : '--') },
    ],
    schemes: [
      { key: 'name', label: 'Name' },
      { key: 'shortName', label: 'Code' },
      { key: 'category', label: 'Category' },
      {
        key: 'status',
        label: 'Status',
        render: (v) => (
          <span
            className={
              v === 'active'
                ? 'badge-green'
                : v === 'closed'
                ? 'badge-red'
                : 'badge-blue'
            }
          >
            {v?.toUpperCase() || 'ACTIVE'}
          </span>
        ),
      },
    ],
    news: [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'source', label: 'Source' },
      {
        key: 'createdAt',
        label: 'Date',
        render: (v) =>
          v
            ? new Date(v).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })
            : '--',
      },
    ],
  };

  const fieldMap = {
    rules: RULE_FIELDS,
    prices: PRICE_FIELDS,
    schemes: SCHEME_FIELDS,
    news: NEWS_FIELDS,
  };

  const STAT_ITEMS = [
    { icon: Users, label: 'Users', value: stats?.users?.total ?? stats?.users, color: 'bg-blue-100 text-info' },
    { icon: Sprout, label: 'Advisory Rules', value: stats?.cropRules ?? stats?.advisoryRules, color: 'bg-primary-100 text-primary-800' },
    { icon: TrendingUp, label: 'Prices', value: stats?.marketPrices ?? stats?.prices, color: 'bg-accent-50 text-accent-700' },
    { icon: FileText, label: 'Schemes', value: stats?.schemes?.total ?? stats?.schemes, color: 'bg-orange-100 text-orange-700' },
    { icon: Newspaper, label: 'News', value: stats?.news?.total ?? stats?.news, color: 'bg-purple-100 text-purple-700' },
    { icon: AlertTriangle, label: 'Alerts', value: stats?.alerts?.total ?? stats?.alerts, color: 'bg-red-100 text-alert-red' },
  ];

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6" />
          {t('nav.admin')}
        </h1>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {STAT_ITEMS.map((item, i) => (
            <StatCard key={i} {...item} />
          ))}
        </div>

        {error && (
          <div className="card border-red-200 bg-red-50 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 pb-1 -mx-1 px-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors min-h-touch ${
                activeTab === key
                  ? 'bg-primary-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Add New Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary text-sm px-4"
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        </div>

        {/* Data Table */}
        <div className="card">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columnMap[activeTab] || []}
              data={tabData}
              onRefresh={fetchTabData}
              refreshing={refreshing}
            />
          )}
        </div>

        {/* Add Modal */}
        {showModal && (
          <AddModal
            title={`Add New ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            fields={fieldMap[activeTab] || []}
            onSubmit={handleAddNew}
            onClose={() => setShowModal(false)}
            loading={saving}
          />
        )}
      </div>
    </div>
  );
}
