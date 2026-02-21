import api from './api';

/**
 * Register a new farmer account.
 * @param {object} data - { name, phone, password, district, state, ... }
 */
export const register = (data) =>
  api.post('/auth/register', data).then((res) => res.data);

/**
 * Login with phone number and password.
 * Accepts either (phone, password) or ({ phone, password }).
 */
export const login = (phoneOrObj, password) => {
  const payload =
    typeof phoneOrObj === 'object'
      ? phoneOrObj
      : { phone: phoneOrObj, password };
  return api.post('/auth/login', payload).then((res) => res.data);
};

/**
 * Get the currently authenticated user's profile.
 */
export const getMe = () => api.get('/auth/me').then((res) => res.data);

/**
 * Update the authenticated user's profile.
 * @param {object} data - Fields to update
 */
export const updateProfile = (data) =>
  api.put('/auth/profile', data).then((res) => res.data);

// ─── WebAuthn Biometric ───

export const webauthnRegisterOptions = () =>
  api.post('/auth/webauthn/register-options').then((res) => res.data);

export const webauthnRegisterVerify = (data) =>
  api.post('/auth/webauthn/register-verify', data).then((res) => res.data);

export const webauthnLoginOptions = () =>
  api.post('/auth/webauthn/login-options').then((res) => res.data);

export const webauthnLoginVerify = (data) =>
  api.post('/auth/webauthn/login-verify', data).then((res) => res.data);

// ─── Face Login ───

export const faceLogin = (faceImage) =>
  api.post('/auth/face-login', { faceImage }).then((res) => res.data);
