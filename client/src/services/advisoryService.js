import api from './api';

/**
 * Get crop advisory based on selected parameters.
 * Accepts either (crop, soilType, season) or ({ crop, soilType, season }).
 */
export const getAdvisory = (cropOrObj, soilType, season) => {
  const params =
    typeof cropOrObj === 'object'
      ? { ...cropOrObj }
      : { crop: cropOrObj, soilType, season };
  // Add current language for server-side translation
  const lang = localStorage.getItem('krishisathi-lang') || 'en';
  if (lang !== 'en') params.lang = lang;
  return api.get('/advisory', { params }).then((res) => res.data);
};

/**
 * Get the list of supported crops.
 */
export const getCrops = () =>
  api.get('/advisory/crops').then((res) => res.data);
