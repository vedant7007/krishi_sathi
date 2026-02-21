import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { getAdvisory } from '../services/advisoryService';
import { translateCrop, translateSoil, translateSeason, translateConfidence, formatDate } from '../utils/translate';
import {
  Sprout,
  Droplets,
  Bug,
  Calendar,
  Scissors,
  Loader2,
  FlaskConical,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react';

const CROP_OPTIONS = [
  'cotton', 'rice', 'wheat', 'maize', 'tomato', 'groundnut', 'soybean',
  'sugarcane', 'onion', 'chilli', 'potato', 'mustard', 'jowar', 'bajra',
  'ragi', 'turmeric', 'ginger', 'garlic', 'brinjal', 'cabbage',
  'cauliflower', 'peas', 'lentil', 'chickpea', 'pigeon_pea', 'green_gram',
  'black_gram', 'sesame', 'sunflower', 'jute', 'tea', 'coffee', 'coconut',
  'banana', 'mango', 'papaya', 'guava', 'pomegranate', 'grape', 'watermelon',
];

const SOIL_OPTIONS = [
  'black', 'red', 'alluvial', 'laterite', 'sandy', 'clay', 'loamy',
  'saline', 'peaty', 'forest', 'mountainous',
];

const SEASON_OPTIONS = ['kharif', 'rabi', 'zaid'];

// Crop-soil compatibility map: maps crop to its ideal soil types
const CROP_SOIL_COMPATIBILITY = {
  rice: ['alluvial', 'clay', 'loamy', 'black', 'peaty'],
  wheat: ['alluvial', 'loamy', 'black', 'clay'],
  cotton: ['black', 'alluvial', 'loamy', 'red'],
  maize: ['loamy', 'alluvial', 'red', 'black'],
  sugarcane: ['alluvial', 'loamy', 'black', 'clay'],
  groundnut: ['red', 'sandy', 'loamy', 'alluvial'],
  soybean: ['black', 'loamy', 'alluvial', 'clay'],
  tomato: ['loamy', 'alluvial', 'red', 'sandy'],
  onion: ['loamy', 'alluvial', 'sandy', 'red'],
  chilli: ['loamy', 'alluvial', 'black', 'red'],
  potato: ['loamy', 'alluvial', 'sandy', 'red'],
  mustard: ['loamy', 'alluvial', 'sandy'],
  jowar: ['black', 'red', 'loamy', 'clay'],
  bajra: ['sandy', 'loamy', 'alluvial', 'red'],
  ragi: ['red', 'loamy', 'laterite', 'sandy'],
  turmeric: ['loamy', 'alluvial', 'clay', 'red'],
  ginger: ['loamy', 'alluvial', 'forest', 'red'],
  garlic: ['loamy', 'alluvial', 'sandy'],
  brinjal: ['loamy', 'alluvial', 'black', 'red'],
  cabbage: ['loamy', 'alluvial', 'clay'],
  cauliflower: ['loamy', 'alluvial', 'clay'],
  peas: ['loamy', 'alluvial', 'clay'],
  lentil: ['loamy', 'alluvial', 'clay', 'black'],
  chickpea: ['black', 'loamy', 'alluvial', 'clay'],
  pigeon_pea: ['black', 'red', 'loamy', 'alluvial'],
  green_gram: ['loamy', 'sandy', 'alluvial', 'red'],
  black_gram: ['black', 'loamy', 'alluvial', 'clay'],
  sesame: ['sandy', 'loamy', 'alluvial', 'red'],
  sunflower: ['black', 'loamy', 'alluvial', 'red'],
  jute: ['alluvial', 'loamy', 'clay', 'peaty'],
  tea: ['forest', 'loamy', 'laterite', 'red'],
  coffee: ['forest', 'laterite', 'loamy', 'red'],
  coconut: ['sandy', 'loamy', 'alluvial', 'laterite', 'red'],
  banana: ['alluvial', 'loamy', 'clay', 'red'],
  mango: ['alluvial', 'loamy', 'laterite', 'red'],
  papaya: ['loamy', 'alluvial', 'sandy'],
  guava: ['loamy', 'alluvial', 'sandy', 'red'],
  pomegranate: ['sandy', 'loamy', 'red', 'black'],
  grape: ['sandy', 'loamy', 'red', 'alluvial'],
  watermelon: ['sandy', 'loamy', 'alluvial'],
};

function checkSoilCompatibility(crop, soil) {
  if (!crop || !soil) return null;
  const compatible = CROP_SOIL_COMPATIBILITY[crop];
  if (!compatible) return null; // unknown crop, skip check
  return compatible.includes(soil);
}

const TABS = [
  { key: 'fertilizer', icon: FlaskConical },
  { key: 'irrigation', icon: Droplets },
  { key: 'pest', icon: Bug },
  { key: 'sowing', icon: Calendar },
  { key: 'harvest', icon: Scissors },
];

function ConfidenceBadge({ level }) {
  const badges = {
    exact: { class: 'badge-green' },
    partial: { class: 'badge-yellow' },
    general: { class: 'badge bg-orange-100 text-orange-800' },
    ai_generated: { class: 'badge bg-indigo-100 text-indigo-800' },
  };
  const badge = badges[level] || badges.general;
  const label = level === 'ai_generated' ? 'AI Generated' : translateConfidence(level);
  return <span className={badge.class}>{label}</span>;
}

function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="skeleton h-6 w-32" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-4 w-5/6" />
    </div>
  );
}

/* ---------- Section-specific renderers ---------- */

function FertilizerSection({ data, t }) {
  if (!data) return <EmptySection t={t} />;
  return (
    <div className="space-y-4">
      {data.type && (
        <InfoRow label={t('advisoryLabels.fertilizerType')} value={data.type} />
      )}
      {data.quantity && (
        <InfoRow label={t('advisoryLabels.quantity')} value={data.quantity} />
      )}
      {data.schedule && (
        <InfoRow label={t('advisoryLabels.schedule')} value={data.schedule} />
      )}
      {data.notes && (
        <InfoRow label={t('advisoryLabels.notes')} value={data.notes} />
      )}
      <GenericEntries data={data} exclude={['type', 'quantity', 'schedule', 'notes']} />
    </div>
  );
}

function IrrigationSection({ data, t }) {
  if (!data) return <EmptySection t={t} />;
  return (
    <div className="space-y-4">
      {data.method && (
        <InfoRow label={t('advisoryLabels.method')} value={data.method} />
      )}
      {data.frequency && (
        <InfoRow label={t('advisoryLabels.frequency')} value={data.frequency} />
      )}
      {data.waterPerAcre && (
        <InfoRow label={t('advisoryLabels.waterPerAcre')} value={data.waterPerAcre} />
      )}
      {data.notes && (
        <InfoRow label={t('advisoryLabels.notes')} value={data.notes} />
      )}
      <GenericEntries data={data} exclude={['method', 'frequency', 'waterPerAcre', 'notes']} />
    </div>
  );
}

function PestSection({ data, t }) {
  if (!data) return <EmptySection t={t} />;
  return (
    <div className="space-y-4">
      {data.commonPests && Array.isArray(data.commonPests) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('advisoryLabels.commonPests')}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.commonPests.map((pest, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100"
              >
                <Bug className="w-3 h-3 mr-1" />
                {typeof pest === 'object' ? pest.name || JSON.stringify(pest) : pest}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.prevention && (
        <InfoRow label={t('advisoryLabels.prevention')} value={data.prevention} />
      )}
      {data.treatment && (
        <InfoRow label={t('advisoryLabels.treatment')} value={data.treatment} />
      )}
      {data.spraySchedule && (
        <InfoRow label={t('advisoryLabels.spraySchedule')} value={data.spraySchedule} />
      )}
      <GenericEntries data={data} exclude={['commonPests', 'prevention', 'treatment', 'spraySchedule']} />
    </div>
  );
}

function SowingSection({ data, t }) {
  if (!data) return <EmptySection t={t} />;
  return (
    <div className="space-y-4">
      {data.method && (
        <InfoRow label={t('advisoryLabels.method')} value={data.method} />
      )}
      {data.depth && (
        <InfoRow label={t('advisoryLabels.depth')} value={data.depth} />
      )}
      {data.spacing && (
        <InfoRow label={t('advisoryLabels.spacing')} value={data.spacing} />
      )}
      {data.bestTime && (
        <InfoRow label={t('advisoryLabels.bestTime')} value={data.bestTime} />
      )}
      {data.seedRate && (
        <InfoRow label={t('advisoryLabels.seedRate')} value={data.seedRate} />
      )}
      <GenericEntries data={data} exclude={['method', 'depth', 'spacing', 'bestTime', 'seedRate']} />
    </div>
  );
}

function HarvestSection({ data, t }) {
  if (!data) return <EmptySection t={t} />;
  return (
    <div className="space-y-4">
      {data.timing && (
        <InfoRow label={t('advisoryLabels.timing')} value={data.timing} />
      )}
      {data.signs && (
        <InfoRow label={t('advisoryLabels.signs')} value={data.signs} />
      )}
      {data.method && (
        <InfoRow label={t('advisoryLabels.method')} value={data.method} />
      )}
      {data.yield && (
        <InfoRow label={t('advisoryLabels.yield')} value={data.yield} />
      )}
      <GenericEntries data={data} exclude={['timing', 'signs', 'method', 'yield']} />
    </div>
  );
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      {Array.isArray(value) ? (
        <ul className="list-disc list-inside space-y-1">
          {value.map((item, i) => (
            <li key={i} className="text-gray-800 text-sm">
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </li>
          ))}
        </ul>
      ) : typeof value === 'object' ? (
        <div className="text-sm text-gray-800">
          {Object.entries(value).map(([k, v]) => (
            <p key={k}>
              <span className="font-medium capitalize">
                {k.replace(/_/g, ' ')}:
              </span>{' '}
              {String(v)}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-gray-800 text-sm leading-relaxed">{String(value)}</p>
      )}
    </div>
  );
}

/** Render any remaining key-value pairs not already handled by the section renderer */
function GenericEntries({ data, exclude = [] }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(
    ([key, v]) => !exclude.includes(key) && v !== null && v !== undefined && v !== ''
  );
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([key, value]) => (
        <InfoRow
          key={key}
          label={key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
          value={value}
        />
      ))}
    </>
  );
}

function EmptySection({ t }) {
  return <p className="text-gray-500 text-sm">{t('advisory.noAdvice')}</p>;
}

const SECTION_RENDERERS = {
  fertilizer: FertilizerSection,
  irrigation: IrrigationSection,
  pest: PestSection,
  sowing: SowingSection,
  harvest: HarvestSection,
};

function AdvisoryTabContent({ data, tabKey, t }) {
  if (!data) return <EmptySection t={t} />;
  const Renderer = SECTION_RENDERERS[tabKey];
  if (Renderer) return <Renderer data={data} t={t} />;

  // Fallback generic renderer
  const entries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (entries.length === 0) return <EmptySection t={t} />;
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <InfoRow
          key={key}
          label={key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
          value={value}
        />
      ))}
    </div>
  );
}

export default function CropAdvisory() {
  const { t } = useTranslation();
  const {
    selectedCrop,
    setSelectedCrop,
    soilType,
    setSoilType,
    season,
    setSeason,
  } = useFarm();

  const [crop, setCrop] = useState(selectedCrop || '');
  const [soil, setSoil] = useState(soilType || '');
  const [selectedSeason, setSelectedSeason] = useState(season || '');
  const [advisory, setAdvisory] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [activeTab, setActiveTab] = useState('fertilizer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compatWarning, setCompatWarning] = useState('');

  // Check crop-soil compatibility whenever either changes
  const handleCropChange = (newCrop) => {
    setCrop(newCrop);
    const isCompat = checkSoilCompatibility(newCrop, soil);
    if (isCompat === false) {
      setCompatWarning(
        t('advisory.soilIncompatible', {
          crop: translateCrop(newCrop),
          soil: translateSoil(soil),
        })
      );
    } else {
      setCompatWarning('');
    }
  };

  const handleSoilChange = (newSoil) => {
    setSoil(newSoil);
    const isCompat = checkSoilCompatibility(crop, newSoil);
    if (isCompat === false) {
      setCompatWarning(
        t('advisory.soilIncompatible', {
          crop: translateCrop(crop),
          soil: translateSoil(newSoil),
        })
      );
    } else {
      setCompatWarning('');
    }
  };

  const handleGetAdvisory = async () => {
    if (!crop || !soil || !selectedSeason) {
      setError(t('auth.fillAllFields', 'Please select all fields'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      // Persist selections to context
      setSelectedCrop(crop);
      setSoilType(soil);
      setSeason(selectedSeason);

      // Service returns { success, data: { advisory, confidence, query }, message }
      const response = await getAdvisory({
        crop,
        soilType: soil,
        season: selectedSeason,
      });

      // Fix: access response.data to get the actual data
      const advisoryData = response.data || response;
      setAdvisory(advisoryData.advisory || advisoryData);
      setConfidence(advisoryData.confidence || response.confidence || 'general');
      setActiveTab('fertilizer');
    } catch (err) {
      setError(
        err?.response?.data?.message || t('common.error')
      );
    } finally {
      setLoading(false);
    }
  };

  // Resolve the data for the active tab
  const getTabData = () => {
    if (!advisory) return null;
    // The advisory object from the DB may have section keys directly
    // or they might be nested under advisory.advisory
    return (
      advisory[activeTab] ||
      advisory?.advisory?.[activeTab] ||
      null
    );
  };

  const mspPrice =
    advisory?.msp?.price ||
    advisory?.mspPrice ||
    advisory?.advisory?.msp?.price ||
    null;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-primary-800 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sprout className="w-6 h-6" />
          {t('advisory.title')}
        </h1>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Selection Card */}
        <div className="card space-y-3">
          {/* Crop */}
          <div>
            <label
              htmlFor="crop"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              {t('advisory.selectCrop')}
            </label>
            <select
              id="crop"
              value={crop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="input-field"
            >
              <option value="">{t('advisory.selectCrop')}</option>
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {translateCrop(c)}
                </option>
              ))}
            </select>
          </div>

          {/* Soil */}
          <div>
            <label
              htmlFor="soil"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              {t('advisory.selectSoil')}
            </label>
            <select
              id="soil"
              value={soil}
              onChange={(e) => handleSoilChange(e.target.value)}
              className="input-field"
            >
              <option value="">{t('advisory.selectSoil')}</option>
              {SOIL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {translateSoil(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Soil Compatibility Warning */}
          {compatWarning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm font-medium">{compatWarning}</p>
            </div>
          )}

          {/* Season */}
          <div>
            <label
              htmlFor="season"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              {t('advisory.selectSeason')}
            </label>
            <select
              id="season"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="input-field"
            >
              <option value="">{t('advisory.selectSeason')}</option>
              {SEASON_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {translateSeason(s)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-alert-red text-sm font-medium">{error}</p>
          )}

          <button
            onClick={handleGetAdvisory}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sprout className="w-5 h-5" />
                {t('advisory.getAdvice')}
              </>
            )}
          </button>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Results */}
        {!loading && advisory && (
          <>
            {/* Confidence + MSP header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  {t('advisory.confidence')}:
                </span>
                <ConfidenceBadge level={confidence || 'general'} />
              </div>

              {mspPrice && (
                <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <IndianRupee className="w-5 h-5 text-primary-800" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{t('advisory.msp')}</p>
                    <p className="text-lg font-bold text-primary-800">
                      {'\u20B9'}{mspPrice}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto gap-1 pb-1 -mx-1 px-1">
              {TABS.map(({ key, icon: Icon }) => (
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
                  {t(`advisory.${key}`)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                {(() => {
                  const tab = TABS.find((tab) => tab.key === activeTab);
                  const TabIcon = tab ? tab.icon : Sprout;
                  return (
                    <>
                      <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                        <TabIcon className="w-5 h-5 text-primary-800" />
                      </div>
                      <h3 className="font-bold text-gray-900">
                        {t(`advisory.${activeTab}`)}
                      </h3>
                    </>
                  );
                })()}
              </div>
              <AdvisoryTabContent
                data={getTabData()}
                tabKey={activeTab}
                t={t}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
