import api from './api';

/**
 * Get weather data for a location.
 * @param {string} location - Location string (e.g. "Warangal" or "lat,lon")
 */
export const getWeather = (location) =>
  api.get('/weather', { params: { location } }).then((res) => res.data);
