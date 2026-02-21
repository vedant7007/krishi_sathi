import api from './api';

// ===================== Dashboard =====================

/**
 * Get admin dashboard statistics.
 */
export const getDashboardStats = () =>
  api.get('/admin/stats').then((res) => res.data);

/** Alias used by AdminPanel page */
export const getStats = () =>
  api.get('/admin/stats').then((res) => res.data);

// ===================== Crop Rules =====================

export const getCropRules = (params = {}) =>
  api.get('/admin/crop-rules', { params }).then((res) => res.data);

/** Alias used by AdminPanel page */
export const getAdvisoryRules = (params = {}) =>
  api.get('/admin/crop-rules', { params }).then((res) => res.data);

export const getCropRuleById = (id) =>
  api.get(`/admin/crop-rules/${id}`).then((res) => res.data);

export const createCropRule = (data) =>
  api.post('/admin/crop-rules', data).then((res) => res.data);

/** Alias used by AdminPanel page */
export const createAdvisoryRule = (data) =>
  api.post('/admin/crop-rules', data).then((res) => res.data);

export const updateCropRule = (id, data) =>
  api.put(`/admin/crop-rules/${id}`, data).then((res) => res.data);

export const deleteCropRule = (id) =>
  api.delete(`/admin/crop-rules/${id}`).then((res) => res.data);

// ===================== Prices =====================

export const getAdminPrices = (params = {}) =>
  api.get('/admin/prices', { params }).then((res) => res.data);

/** Alias used by AdminPanel page */
export const getMarketPrices = (params = {}) =>
  api.get('/admin/prices', { params }).then((res) => res.data);

export const createPrice = (data) =>
  api.post('/admin/prices', data).then((res) => res.data);

/** Alias used by AdminPanel page */
export const createMarketPrice = (data) =>
  api.post('/admin/prices', data).then((res) => res.data);

export const updatePrice = (id, data) =>
  api.put(`/admin/prices/${id}`, data).then((res) => res.data);

export const deletePrice = (id) =>
  api.delete(`/admin/prices/${id}`).then((res) => res.data);

// ===================== Schemes =====================

export const getAdminSchemes = (params = {}) =>
  api.get('/admin/schemes', { params }).then((res) => res.data);

/** Alias used by AdminPanel page */
export const getSchemes = (params = {}) =>
  api.get('/admin/schemes', { params }).then((res) => res.data);

export const createScheme = (data) =>
  api.post('/admin/schemes', data).then((res) => res.data);

export const updateScheme = (id, data) =>
  api.put(`/admin/schemes/${id}`, data).then((res) => res.data);

export const deleteScheme = (id) =>
  api.delete(`/admin/schemes/${id}`).then((res) => res.data);

// ===================== News =====================

export const getAdminNews = (params = {}) =>
  api.get('/admin/news', { params }).then((res) => res.data);

/** Alias used by AdminPanel page */
export const getNewsItems = (params = {}) =>
  api.get('/admin/news', { params }).then((res) => res.data);

export const createNews = (data) =>
  api.post('/admin/news', data).then((res) => res.data);

/** Alias used by AdminPanel page */
export const createNewsItem = (data) =>
  api.post('/admin/news', data).then((res) => res.data);

export const updateNews = (id, data) =>
  api.put(`/admin/news/${id}`, data).then((res) => res.data);

export const deleteNews = (id) =>
  api.delete(`/admin/news/${id}`).then((res) => res.data);
