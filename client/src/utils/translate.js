import i18n from '../i18n/i18n';

// Get current language
export const getLang = () => i18n.language || 'en';

// Translate crop name
export const translateCrop = (crop) => {
  if (!crop) return '';
  return i18n.t(`crops.${crop}`, crop.charAt(0).toUpperCase() + crop.slice(1).replace(/_/g, ' '));
};

// Translate soil type
export const translateSoil = (soil) => {
  if (!soil) return '';
  return i18n.t(`soils.${soil}`, soil.charAt(0).toUpperCase() + soil.slice(1));
};

// Translate season
export const translateSeason = (season) => {
  if (!season) return '';
  return i18n.t(`seasons.${season}`, season.charAt(0).toUpperCase() + season.slice(1));
};

// Translate state
export const translateState = (state) => {
  if (!state) return '';
  const key = state.toLowerCase().replace(/\s+/g, '_').replace(/&/g, '');
  return i18n.t(`states.${key}`, state);
};

// Translate weather condition
export const translateWeatherCondition = (condition) => {
  if (!condition) return '';
  const key = condition.toLowerCase().replace(/\s+/g, '_');
  return i18n.t(`weatherConditions.${key}`, condition);
};

// Translate farming action
export const translateFarmingAction = (action) => {
  if (!action) return '';
  // Map common farming actions to i18n keys
  const actionMap = {
    'Skip irrigation today': 'weather.skipIrrigation',
    'Do not spray pesticides': 'weather.sprayNotRecommended',
    'High humidity - watch for fungal diseases': 'weather.highHumidity',
    'Protect crops from frost': 'weather.protectFrost',
    'Provide shade to nursery plants': 'weather.provideShade',
    'Good conditions for field work': 'weather.goodConditions',
    'Regular irrigation recommended': 'weather.regularIrrigation',
    'Monitor crops for pest activity': 'weather.monitorPests',
    'Prolonged high humidity expected': 'weather.prolongedHumidity',
    'Ideal conditions for spraying': 'weather.idealForSpraying',
  };
  const key = actionMap[action];
  return key ? i18n.t(key, action) : action;
};

// Format date in current language
export const formatDate = (dateStr, options = {}) => {
  const date = new Date(dateStr);
  const lang = getLang();
  const localeMap = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };
  const locale = localeMap[lang] || 'en-IN';

  const defaultOpts = { weekday: 'short', month: 'short', day: 'numeric', ...options };
  return date.toLocaleDateString(locale, defaultOpts);
};

// Format date with full day name
export const formatDateFull = (dateStr) => {
  return formatDate(dateStr, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

// Get day name
export const getDayName = (dateStr) => {
  return formatDate(dateStr, { weekday: 'long' });
};

// Translate advisory text - map common phrases
// This maps English advisory text to translated equivalents
export const translateAdvisoryText = (text) => {
  if (!text) return '';
  const lang = getLang();
  if (lang === 'en') return text;

  // For Hindi and Telugu, we translate common phrases
  return i18n.t(`advisoryPhrases.${hashText(text)}`, text);
};

// Simple hash for advisory text lookup
const hashText = (text) => {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
};

// Translate severity/confidence labels
export const translateConfidence = (confidence) => {
  const map = { exact: 'advisory.exact', partial: 'advisory.partial', general: 'advisory.general' };
  return i18n.t(map[confidence] || 'advisory.general', confidence);
};

export const translateSeverity = (severity) => {
  const map = { CRITICAL: 'emergency.critical', WARNING: 'emergency.warning', INFO: 'emergency.info' };
  return i18n.t(map[severity] || severity, severity);
};
