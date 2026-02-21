import api from './api';

/**
 * Get government schemes with optional filters.
 * @param {object} filters - { state, category, search, page, limit }
 */
export const getSchemes = (filters = {}) => {
  const lang = localStorage.getItem('krishisathi-lang') || 'en';
  if (lang !== 'en') filters.lang = lang;
  return api.get('/schemes', { params: filters }).then((res) => res.data);
};

/**
 * Get a single scheme by its ID.
 * @param {string} id - Scheme ID
 */
export const getSchemeById = (id) =>
  api.get(`/schemes/${id}`).then((res) => res.data);

/**
 * Check eligibility for a specific scheme.
 * Accepts either (id, data) or ({ schemeId, ...data }).
 */
export const checkEligibility = (idOrObj, data) => {
  const lang = localStorage.getItem('krishisathi-lang') || 'en';
  if (typeof idOrObj === 'object') {
    const { schemeId, ...rest } = idOrObj;
    if (lang !== 'en') rest.lang = lang;
    return api
      .post(`/schemes/${schemeId}/eligibility`, rest)
      .then((res) => res.data);
  }
  const body = { ...data };
  if (lang !== 'en') body.lang = lang;
  return api
    .post(`/schemes/${idOrObj}/eligibility`, body)
    .then((res) => res.data);
};
