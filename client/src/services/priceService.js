import api from './api';

/**
 * Get current mandi prices for a crop in a given state.
 * Accepts either (crop, state) or ({ crop, state }).
 * Server returns { success, data: { prices, count, query }, message }
 * After .then(res => res.data), caller gets { success, data, message }.
 */
export const getPrices = (cropOrObj, state) => {
  const params =
    typeof cropOrObj === 'object' ? cropOrObj : { crop: cropOrObj, state };
  return api.get('/prices', { params }).then((res) => res.data);
};

/**
 * Get historical price data for a crop at a specific mandi.
 * Accepts either (crop, mandi, days) or ({ crop, state, mandi, days }).
 * Server returns { success, data: { history, stats, query }, message }
 */
export const getPriceHistory = (cropOrObj, mandi, days = 14) => {
  const params =
    typeof cropOrObj === 'object'
      ? { days, ...cropOrObj }
      : { crop: cropOrObj, mandi, days };
  return api.get('/prices/history', { params }).then((res) => res.data);
};

/**
 * Get AI-powered sell recommendation for a crop at a mandi.
 * Accepts either (crop, mandi) or ({ crop, state, mandi }).
 * Server route: /api/prices/sell-recommendation
 * Server returns { success, data: { shouldSell, score, reasons, ... }, message }
 */
export const getSellRecommendation = (cropOrObj, mandi) => {
  const params =
    typeof cropOrObj === 'object' ? cropOrObj : { crop: cropOrObj, mandi };
  return api.get('/prices/sell-recommendation', { params }).then((res) => res.data);
};
