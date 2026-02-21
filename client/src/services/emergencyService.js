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
 * Get all emergency alerts.
 */
export const getAlerts = () =>
  api.get('/emergency/alerts').then((res) => res.data);

/**
 * Get aggregated alert statistics.
 */
export const getAlertStats = () =>
  api.get('/emergency/stats').then((res) => res.data);
