import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { translateSeverity, formatDate } from '../utils/translate';
import {
  getAlerts,
  broadcastAlert,
} from '../services/emergencyService';
import {
  AlertTriangle,
  Bell,
  Loader2,
  Send,
  MapPin,
  Clock,
  ShieldAlert,
  Info,
  AlertCircle,
  X,
  Plus,
} from 'lucide-react';

const ALERT_TYPES = [
  'flood',
  'drought',
  'cyclone',
  'pest_outbreak',
  'heatwave',
  'frost',
  'hailstorm',
  'price_crash',
  'disease',
  'general',
];

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', color: 'bg-alert-red', textColor: 'text-white' },
  { value: 'WARNING', color: 'bg-accent-700', textColor: 'text-white' },
  { value: 'INFO', color: 'bg-info', textColor: 'text-white' },
];

const CHANNEL_OPTIONS = ['sms', 'whatsapp', 'voice'];

const SEVERITY_STYLES = {
  CRITICAL: {
    border: 'border-l-alert-red',
    bg: 'bg-red-50',
    badge: 'badge-red',
    icon: ShieldAlert,
    iconColor: 'text-alert-red',
  },
  WARNING: {
    border: 'border-l-accent-700',
    bg: 'bg-accent-50',
    badge: 'badge-yellow',
    icon: AlertTriangle,
    iconColor: 'text-accent-700',
  },
  INFO: {
    border: 'border-l-info',
    bg: 'bg-blue-50',
    badge: 'badge-blue',
    icon: Info,
    iconColor: 'text-info',
  },
};

function AlertCard({ alert, t }) {
  const severity = alert.severity?.toUpperCase() || 'INFO';
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.INFO;
  const Icon = style.icon;

  const timestamp = alert.createdAt
    ? formatDate(alert.createdAt, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className={`rounded-xl border-l-4 p-4 shadow-sm ${style.border} ${style.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          severity === 'CRITICAL' ? 'bg-red-100' : severity === 'WARNING' ? 'bg-yellow-100' : 'bg-blue-100'
        }`}>
          <Icon className={`w-5 h-5 ${style.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`${style.badge} text-xs whitespace-nowrap`}>
              {translateSeverity(severity)}
            </span>
            {alert.type && (
              <span className="text-xs text-gray-500 capitalize whitespace-nowrap">
                {t(`emergency.${alert.type}`, alert.type.replace(/_/g, ' '))}
              </span>
            )}
          </div>

          <h3 className="font-bold text-gray-900 break-words leading-snug">
            {alert.title}
          </h3>
          <p className="text-sm text-gray-700 mt-1.5 leading-relaxed break-words">
            {alert.message}
          </p>

          {alert.affectedDistricts && alert.affectedDistricts.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-black/5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-500">Affected Areas</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {alert.affectedDistricts.map((d) => (
                  <span key={d} className="text-xs bg-white/70 text-gray-600 px-2 py-0.5 rounded-full border border-black/5">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {timestamp && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              <Clock className="w-3 h-3 flex-shrink-0" />
              {timestamp}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BroadcastForm({ t, onSubmit, loading }) {
  const [form, setForm] = useState({
    type: 'general',
    severity: 'WARNING',
    title: '',
    message: '',
    channels: ['sms'],
  });
  const [districtInput, setDistrictInput] = useState('');
  const [districts, setDistricts] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleChannelToggle = (channel) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  const addDistrict = () => {
    const trimmed = districtInput.trim();
    if (trimmed && !districts.includes(trimmed)) {
      setDistricts((prev) => [...prev, trimmed]);
      setDistrictInput('');
    }
  };

  const removeDistrict = (d) => {
    setDistricts((prev) => prev.filter((item) => item !== d));
  };

  const handleDistrictKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDistrict();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, affectedDistricts: districts });
  };

  // Map channel keys to translation keys
  const channelLabelMap = {
    sms: 'profile.sms',
    whatsapp: 'profile.whatsapp',
    voice: 'profile.voice',
  };

  return (
    <form onSubmit={handleSubmit} className="card shadow-md space-y-5">
      <h2 className="section-title flex items-center gap-2">
        <Bell className="w-5 h-5 text-accent-700 flex-shrink-0" />
        <span className="break-words">{t('emergency.broadcast')}</span>
      </h2>

      {/* Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t('emergency.type')}
        </label>
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="input-field"
        >
          {ALERT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`emergency.${type}`, type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))}
            </option>
          ))}
        </select>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('emergency.severity')}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SEVERITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer border-2 transition-all text-center ${
                form.severity === opt.value
                  ? `${opt.color} ${opt.textColor} border-transparent shadow-sm`
                  : 'bg-white border-gray-200 text-gray-700'
              }`}
            >
              <input
                type="radio"
                name="severity"
                value={opt.value}
                checked={form.severity === opt.value}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-sm font-semibold">
                {t(`emergency.${opt.value.toLowerCase()}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t('emergency.alertTitle')}
        </label>
        <input
          name="title"
          type="text"
          value={form.title}
          onChange={handleChange}
          className="input-field"
          required
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t('emergency.message')}
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          rows={4}
          className="input-field resize-none"
          required
        />
      </div>

      {/* Affected Districts */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t('emergency.affectedAreas')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={districtInput}
            onChange={(e) => setDistrictInput(e.target.value)}
            onKeyDown={handleDistrictKeyDown}
            placeholder={t('emergency.addDistrict')}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addDistrict}
            className="btn-outline px-3 min-w-touch"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {districts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {districts.map((d) => (
              <span
                key={d}
                className="badge bg-gray-100 text-gray-700 flex items-center gap-1"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeDistrict(d)}
                  className="hover:text-alert-red"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Channels */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('emergency.channels')}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CHANNEL_OPTIONS.map((ch) => (
            <label
              key={ch}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer border-2 transition-all ${
                form.channels.includes(ch)
                  ? 'bg-primary-100 border-primary-500 text-primary-800 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={form.channels.includes(ch)}
                onChange={() => handleChannelToggle(ch)}
                className="sr-only"
              />
              <span className="text-sm font-medium">
                {t(channelLabelMap[ch] || ch)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            {t('emergency.send')}
          </>
        )}
      </button>
    </form>
  );
}

export default function Emergency() {
  const { t } = useTranslation();
  const { user } = useFarm();
  const isAdmin = user?.role === 'admin';

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const response = await getAlerts();
        const inner = response?.data || response;
        if (!cancelled) setAlerts(inner?.alerts || []);
      } catch (err) {
        if (!cancelled)
          setError(err?.response?.data?.message || t('common.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleBroadcast = async (formData) => {
    setBroadcasting(true);
    setError('');
    setSuccess('');
    try {
      await broadcastAlert(formData);
      setSuccess(t('emergency.broadcastSuccess'));
      // Refresh alerts
      const response = await getAlerts();
      const inner = response?.data || response;
      setAlerts(inner?.alerts || []);
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-alert-red to-red-800 text-white px-4 pt-6 pb-10 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          {t('emergency.title')}
        </h1>
        <p className="text-red-100 text-sm mt-1">
          {t('emergency.subtitle', 'Stay informed about critical farming alerts')}
        </p>
      </div>

      <div className="px-4 -mt-6 space-y-4 relative z-10">
        {/* Admin Broadcast Form */}
        {isAdmin && (
          <BroadcastForm
            t={t}
            onSubmit={handleBroadcast}
            loading={broadcasting}
          />
        )}

        {success && (
          <div className="card shadow-md border-green-200 bg-green-50 text-primary-800 text-sm font-medium">
            {success}
          </div>
        )}

        {error && (
          <div className="card shadow-md border-red-200 bg-red-50 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        {/* Recent Alerts — wrapped in card so it has a white background over the gradient */}
        <div className="card shadow-md">
          <h2 className="section-title mb-3">{t('emergency.recentAlerts')}</h2>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div className="skeleton h-5 w-20" />
                  <div className="skeleton h-5 w-48" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-3 w-32" />
                </div>
              ))}
            </div>
          )}

          {!loading && alerts.length > 0 && (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <AlertCard
                  key={alert._id || alert.id || i}
                  alert={alert}
                  t={t}
                />
              ))}
            </div>
          )}

          {!loading && alerts.length === 0 && !error && (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                {t('emergency.noAlerts')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
