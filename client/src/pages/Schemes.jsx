import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { getSchemes, checkEligibility } from '../services/schemeService';
import { translateCrop, translateSoil, translateState, formatDate, getLang } from '../utils/translate';
import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  IndianRupee,
  ArrowRight,
} from 'lucide-react';

const CATEGORIES = [
  'all',
  'subsidy',
  'insurance',
  'credit',
  'infrastructure',
  'training',
];

// Map category keys to translation keys
const CATEGORY_T_MAP = {
  all: 'schemes.categoryAll',
  subsidy: 'schemes.categorySubsidy',
  insurance: 'schemes.categoryInsurance',
  credit: 'schemes.categoryCredit',
  infrastructure: 'schemes.categoryInfrastructure',
  training: 'schemes.categoryTraining',
};

function StatusBadge({ status, t }) {
  const normalized = (status || 'active').toLowerCase();
  const colorMap = {
    active: 'bg-green-100 text-green-800 border border-green-200',
    upcoming: 'bg-blue-100 text-blue-800 border border-blue-200',
    closed: 'bg-red-100 text-red-800 border border-red-200',
  };
  const labelMap = {
    active: t('schemes.statusActive'),
    upcoming: t('schemes.statusUpcoming'),
    closed: t('schemes.statusClosed'),
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        colorMap[normalized] || 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      }`}
    >
      {labelMap[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

function SchemeCard({ scheme, user, t }) {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [eligibility, setEligibility] = useState(null);

  const handleCheckEligibility = async () => {
    setChecking(true);
    try {
      const response = await checkEligibility({
        schemeId: scheme._id || scheme.id,
        district: user?.district,
        state: user?.state,
        landHolding: user?.landHolding,
        crop: user?.primaryCrop,
        category: user?.farmerCategory,
      });
      // After .then(res => res.data): { success, data: { eligible, reasons } }
      setEligibility(response?.data || response);
    } catch {
      setEligibility({
        eligible: false,
        reasons: [t('schemes.eligibilityError')],
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-gray-900">{scheme.name}</h3>
            {scheme.shortName && (
              <span className="badge bg-primary-100 text-primary-800 text-xs">
                {scheme.shortName}
              </span>
            )}
          </div>
          <StatusBadge status={scheme.status} t={t} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mt-3 leading-relaxed">
        {scheme.description}
      </p>

      {/* Benefits */}
      {scheme.benefits && (
        <div className="mt-3 p-3 bg-green-50 rounded-lg">
          <p className="text-xs font-semibold text-primary-800 uppercase mb-1 flex items-center gap-1">
            <IndianRupee className="w-3 h-3" />
            {t('schemes.benefits')}
          </p>
          <p className="text-sm text-gray-800">{scheme.benefits}</p>
        </div>
      )}

      {/* Deadline */}
      {scheme.deadline && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase">
            {t('schemes.deadline')}
          </p>
          <p className="text-sm text-gray-700">
            {formatDate(scheme.deadline, { weekday: undefined, month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* Expand / Eligibility Buttons */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleCheckEligibility}
          disabled={checking}
          className="btn-outline text-sm px-4 py-2 flex-1"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Shield className="w-4 h-4" />
              {t('schemes.eligibility')}
            </>
          )}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 min-h-touch min-w-touch flex items-center justify-center"
          aria-label="Toggle details"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Eligibility Result */}
      {eligibility && (
        <div
          className={`mt-3 p-3 rounded-lg border ${
            eligibility.eligible
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {eligibility.eligible ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-primary-800" />
                <p className="font-semibold text-primary-800">
                  {t('schemes.eligible')}
                </p>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-alert-red" />
                <p className="font-semibold text-alert-red">
                  {t('schemes.notEligible')}
                </p>
              </>
            )}
          </div>

          {eligibility.reasons && eligibility.reasons.length > 0 && (
            <ul className="space-y-1 mt-2">
              {eligibility.reasons.map((reason, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-1">
                  <span className="text-gray-400">&#8226;</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {/* Eligibility Criteria */}
          {scheme.eligibility && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                {t('schemes.eligibilityCriteria')}
              </p>
              <ul className="space-y-1">
                {scheme.eligibility.landHoldingMax != null && (
                  <li className="text-sm text-gray-700 flex items-start gap-1">
                    <span className="text-gray-400">&#8226;</span>
                    {t('schemes.maxLand')}: {scheme.eligibility.landHoldingMax} {t('schemes.acres')}
                  </li>
                )}
                {scheme.eligibility.landHoldingMin != null && (
                  <li className="text-sm text-gray-700 flex items-start gap-1">
                    <span className="text-gray-400">&#8226;</span>
                    {t('schemes.minLand')}: {scheme.eligibility.landHoldingMin} {t('schemes.acres')}
                  </li>
                )}
                {scheme.eligibility.crops?.length > 0 && (
                  <li className="text-sm text-gray-700 flex items-start gap-1">
                    <span className="text-gray-400">&#8226;</span>
                    {t('schemes.eligibleCrops')}: {scheme.eligibility.crops.map((c) => translateCrop(c)).join(', ')}
                  </li>
                )}
                {scheme.eligibility.states?.length > 0 && (
                  <li className="text-sm text-gray-700 flex items-start gap-1">
                    <span className="text-gray-400">&#8226;</span>
                    {t('schemes.eligibleStates')}: {scheme.eligibility.states.map((s) => translateState(s)).join(', ')}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Required Documents */}
          {scheme.documents && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                {t('schemes.documents')}
              </p>
              <ul className="space-y-1">
                {(Array.isArray(scheme.documents)
                  ? scheme.documents
                  : scheme.documents.split(/[,;]\s*/)
                ).map((doc, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-1">
                    <span className="text-gray-400">&#8226;</span>
                    {doc.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Application URL */}
          {scheme.applicationUrl && (
            <a
              href={scheme.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-900 transition-colors mt-1"
            >
              {t('schemes.applyNow')}
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function Schemes() {
  const { t } = useTranslation();
  const { user, language } = useFarm();

  const [schemes, setSchemes] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchSchemes = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getSchemes({ category: category === 'all' ? undefined : category });
        const inner = response?.data || response;
        if (!cancelled) setSchemes(inner?.schemes || []);
      } catch (err) {
        if (!cancelled)
          setError(err?.response?.data?.message || t('common.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSchemes();
    return () => {
      cancelled = true;
    };
  }, [category, language, t]);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          {t('schemes.title')}
        </h1>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Category Tabs - ALL translated */}
        <div className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors min-h-touch ${
                category === cat
                  ? 'bg-primary-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t(CATEGORY_T_MAP[cat], cat.charAt(0).toUpperCase() + cat.slice(1))}
            </button>
          ))}
        </div>

        {error && (
          <div className="card border-red-200 bg-red-50 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card space-y-3">
                <div className="skeleton h-5 w-48" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-10 w-40" />
              </div>
            ))}
          </div>
        )}

        {/* Schemes List */}
        {!loading && schemes.length > 0 && (
          <div className="space-y-4">
            {schemes.map((scheme, i) => (
              <SchemeCard
                key={scheme._id || scheme.id || i}
                scheme={scheme}
                user={user}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && schemes.length === 0 && !error && (
          <div className="card text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {t('schemes.noSchemes')}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              {t('schemes.noSchemesDescription')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
