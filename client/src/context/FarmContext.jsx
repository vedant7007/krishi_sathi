import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from '../i18n/i18n';

const FarmContext = createContext();

const STORAGE_KEYS = {
  user: 'krishisathi-user',
  token: 'krishisathi-token',
  crop: 'krishisathi-crop',
  soil: 'krishisathi-soil',
  season: 'krishisathi-season',
  language: 'krishisathi-lang',
};

function getStored(key, fallback = null, parse = false) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return parse ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

export function FarmProvider({ children }) {
  // --------------- Auth state ---------------
  const [user, setUser] = useState(() => getStored(STORAGE_KEYS.user, null, true));
  const [token, setToken] = useState(() => getStored(STORAGE_KEYS.token));

  // --------------- Farm preferences ---------------
  const [selectedCrop, setSelectedCrop] = useState(() => getStored(STORAGE_KEYS.crop, ''));
  const [soilType, setSoilType] = useState(() => getStored(STORAGE_KEYS.soil, ''));
  const [season, setSeason] = useState(() => getStored(STORAGE_KEYS.season, ''));

  // --------------- Runtime data ---------------
  const [weather, setWeather] = useState(null);
  const [advisory, setAdvisory] = useState(null);

  // --------------- Language ---------------
  // If logged in, always use the user's registered language on reload.
  // Only fall back to localStorage (session override) when not logged in.
  const [language, setLanguageState] = useState(() => {
    const storedUser = getStored(STORAGE_KEYS.user, null, true);
    if (storedUser && storedUser.language) return storedUser.language;
    const stored = getStored(STORAGE_KEYS.language);
    if (stored) return stored;
    return 'en';
  });

  // =============== Persistence via useEffect ===============
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.user);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.token, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.token);
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.crop, selectedCrop);
  }, [selectedCrop]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.soil, soilType);
  }, [soilType]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.season, season);
  }, [season]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.language, language);
    i18n.changeLanguage(language);
  }, [language]);

  // Sync language when user changes (e.g., after login/registration)
  // Always apply the user's registered language on login
  useEffect(() => {
    if (user && user.language) {
      setLanguageState(user.language);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // =============== Actions ===============
  const login = useCallback((newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setWeather(null);
    setAdvisory(null);
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }, []);

  const updateUser = useCallback((data) => {
    setUser((prev) => (prev ? { ...prev, ...data } : data));
  }, []);

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem(STORAGE_KEYS.language, lang);
  }, []);

  // =============== Context value ===============
  const value = {
    // State
    user,
    token,
    selectedCrop,
    soilType,
    season,
    weather,
    advisory,
    language,
    // Actions
    login,
    logout,
    updateUser,
    setSelectedCrop,
    setSoilType,
    setSeason,
    setWeather,
    setAdvisory,
    setLanguage,
  };

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export const useFarm = () => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
};

export default FarmContext;
