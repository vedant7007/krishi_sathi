import api from './api';

/**
 * Create a new emergency alert (admin / authorized users).
 * @param {object} data - { type, severity, message, affectedAreas, ... }
 */
export const createAlert = (data) =>
  api.post('/emergency/alert', data).then((res) => res.data);

/**
 * Alias for createAlert - used by broadcast form.
 */
export const broadcastAlert = (data) =>
  api.post('/emergency/alert', data).then((res) => res.data);

/**
 * Get all emergency alerts (with language translation support).
 */
export const getAlerts = () => {
  const lang = localStorage.getItem('krishisathi-lang') || 'en';
  const params = {};
  if (lang !== 'en') params.lang = lang;
  return api.get('/emergency/alerts', { params }).then((res) => res.data);
};

/**
 * Get aggregated alert statistics.
 */
export const getAlertStats = () =>
  api.get('/emergency/stats').then((res) => res.data);
