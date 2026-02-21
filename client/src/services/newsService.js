import api from './api';

/**
 * Get agriculture news articles with optional filters.
 * @param {object} params - { category, search, page, limit, language }
 */
export const getNews = (params = {}) => {
  const lang = localStorage.getItem('krishisathi-lang') || 'en';
  if (lang !== 'en') params.lang = lang;
  return api.get('/news', { params }).then((res) => res.data);
};

/**
 * Get a single news article by its ID.
 * @param {string} id - News article ID
 */
export const getNewsById = (id) =>
  api.get(`/news/${id}`).then((res) => res.data);
