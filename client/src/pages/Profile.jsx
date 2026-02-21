import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { updateProfile, webauthnRegisterOptions, webauthnRegisterVerify } from '../services/authService';
import { startRegistration } from '@simplewebauthn/browser';
import { translateCrop, translateSoil, translateSeason, translateState, translateConfidence, formatDate } from '../utils/translate';
import i18n from '../i18n/i18n';
import {
  User,
  Phone,
  MapPin,
  Landmark,
  Sprout,
  Ruler,
  Globe,
  Bell,
  Loader2,
  Save,
  CheckCircle2,
  Shield,
  Navigation,
  Layers,
  Wheat,
  Camera,
  ShieldCheck,
  Fingerprint,
} from 'lucide-react';

const CROP_OPTIONS = [
  'cotton', 'rice', 'wheat', 'maize', 'tomato', 'groundnut', 'soybean',
  'sugarcane', 'onion', 'chilli', 'potato', 'mustard', 'jowar', 'bajra',
  'ragi', 'turmeric', 'ginger', 'garlic', 'brinjal', 'cabbage',
  'cauliflower', 'peas', 'lentil', 'chickpea', 'pigeon_pea', 'green_gram',
  'black_gram', 'sesame', 'sunflower', 'jute', 'tea', 'coffee', 'coconut',
  'banana', 'mango', 'papaya', 'guava', 'pomegranate', 'grape', 'watermelon',
];

const SOIL_OPTIONS = [
  'black', 'red', 'alluvial', 'laterite', 'sandy', 'clay', 'loamy',
  'saline', 'peaty', 'forest', 'mountainous',
];

const STATE_OPTIONS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
];

function maskAadhaar(val) {
  if (!val || val.length < 4) return val || '';
  return 'XXXX-XXXX-' + val.slice(-4);
}

function ToggleSwitch({ enabled, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full py-3"
      style={{ minHeight: '48px' }}
      role="switch"
      aria-checked={enabled}
    >
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-primary-800' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary-800" />
      </div>
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateUser, setLanguage, language } = useFarm();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    aadhaarNumber: '',
    district: '',
    state: '',
    primaryCrop: '',
    soilType: '',
    landHolding: '',
    language: language || 'en',
  });

  const [location, setLocation] = useState({
    lat: '',
    lon: '',
    address: '',
  });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const [alertPrefs, setAlertPrefs] = useState({
    sms: true,
    whatsapp: false,
    voice: false,
    push: false,
  });

  // Face capture state
  const [faceImage, setFaceImage] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Biometric (WebAuthn) state
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricMsg, setBiometricMsg] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingAadhaar, setEditingAadhaar] = useState(false);

  // Pre-fill form from context
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        aadhaarNumber: user.aadhaarNumber || '',
        district: user.district || '',
        state: user.state || '',
        primaryCrop: user.primaryCrop || '',
        soilType: user.soilType || '',
        landHolding: user.landHolding ? String(user.landHolding) : '',
        language: language || 'en',
      });
      setLocation({
        lat: user.location?.lat ? String(user.location.lat) : '',
        lon: user.location?.lon ? String(user.location.lon) : '',
        address: user.location?.address || '',
      });
      setAlertPrefs({
        sms: user.alertPreferences?.sms ?? true,
        whatsapp: user.alertPreferences?.whatsapp ?? false,
        voice: user.alertPreferences?.voice ?? false,
        push: user.alertPreferences?.push ?? false,
      });
      if (user.faceImage) setFaceImage(user.faceImage);
      if (user.webauthnCredentials && user.webauthnCredentials.length > 0) {
        setBiometricRegistered(true);
      }
    }
  }, [user, language]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setForm((prev) => ({ ...prev, language: newLang }));
    // Immediately change the UI language
    i18n.changeLanguage(newLang);
    setLanguage(newLang);
  };

  const handleAadhaarChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    setForm((prev) => ({ ...prev, aadhaarNumber: raw }));
  };

  const formatAadhaarDisplay = (val) => {
    if (!val) return '';
    const parts = [];
    for (let i = 0; i < val.length; i += 4) {
      parts.push(val.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  const handleToggle = (key) => {
    setAlertPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const detectGPS = () => {
    if (!navigator.geolocation) {
      setGpsError(t('profile.gpsNotSupported'));
      return;
    }

    setGpsLoading(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let address = '';

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await response.json();
          if (data.display_name) {
            address = data.display_name;
          }
        } catch {
          address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }

        setLocation({
          lat: latitude.toFixed(6),
          lon: longitude.toFixed(6),
          address,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? t('profile.gpsDenied')
            : t('profile.gpsError')
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const openCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setCameraError(t('register.cameraError', 'Could not access camera. Please allow camera permission.'));
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFaceImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setFaceImage('');
    openCamera();
  }, [openCamera]);

  const handleBiometricRegister = async () => {
    setBiometricLoading(true);
    setBiometricMsg('');
    try {
      const optionsRes = await webauthnRegisterOptions();
      const attResp = await startRegistration({ optionsJSON: optionsRes.data });
      await webauthnRegisterVerify(attResp);
      setBiometricRegistered(true);
      setBiometricMsg(t('profile.biometricSuccess', 'Biometric registered! You can now login with fingerprint/Face ID.'));
    } catch (err) {
      setBiometricMsg(
        err?.response?.data?.message || err?.message || t('profile.biometricError', 'Failed to register biometric. Try again.')
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        district: form.district,
        state: form.state,
        primaryCrop: form.primaryCrop,
        soilType: form.soilType,
        landHolding: form.landHolding ? Number(form.landHolding) : undefined,
        language: form.language,
        alertPreferences: alertPrefs,
      };

      if (faceImage) payload.faceImage = faceImage;

      if (form.aadhaarNumber) {
        payload.aadhaarNumber = form.aadhaarNumber;
      }

      if (location.lat && location.lon) {
        payload.location = {
          lat: Number(location.lat),
          lon: Number(location.lon),
          address: location.address || '',
        };
      }

      const updatedUser = await updateProfile(payload);

      // Update context
      updateUser(updatedUser?.user || payload);
      setLanguage(form.language);

      setSuccess(t('profile.saved'));
      setEditingAadhaar(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err?.response?.data?.message || t('common.error')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-primary-800 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" />
          {t('profile.title')}
        </h1>
      </div>

      <div className="px-4 -mt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Info Card */}
          <div className="card space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              {faceImage ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary-200 shadow flex-shrink-0">
                  <img src={faceImage} alt="Face" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-primary-800" />
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900 text-lg">
                  {form.name || t('profile.title')}
                </p>
                <p className="text-sm text-gray-500">{form.phone}</p>
                {form.aadhaarNumber && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t('register.aadhaar')}: {maskAadhaar(form.aadhaarNumber)}
                  </p>
                )}
              </div>
            </div>

            {/* Face Photo Section */}
            <div className="pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary-800" />
                <h4 className="text-sm font-bold text-gray-800">
                  {t('profile.facePhoto', 'Face Photo')}
                </h4>
                {faceImage && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                    {t('profile.faceSet', 'Set')}
                  </span>
                )}
              </div>

              {!faceImage && !cameraOpen && (
                <button
                  type="button"
                  onClick={openCamera}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 text-primary-800 font-semibold text-sm hover:bg-primary-100 transition-colors"
                  style={{ minHeight: '48px' }}
                >
                  <Camera className="w-5 h-5" />
                  {t('profile.captureForLogin', 'Capture Face for Login Verification')}
                </button>
              )}

              {cameraError && (
                <p className="text-xs text-red-500 mt-2">{cameraError}</p>
              )}

              {cameraOpen && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ maxWidth: '280px', margin: '0 auto' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-xl"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-28 h-36 border-2 border-dashed border-white/50 rounded-full" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={capturePhoto} className="btn-primary px-4 text-sm">
                      <Camera className="w-4 h-4" />
                      {t('register.capture', 'Capture')}
                    </button>
                    <button type="button" onClick={stopCamera} className="btn-outline px-4 text-sm">
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}

              {faceImage && !cameraOpen && (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary-200 shadow flex-shrink-0">
                    <img
                      src={faceImage}
                      alt="Face"
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={retakePhoto} className="flex items-center gap-1 text-sm font-semibold text-primary-800 hover:underline">
                      <Camera className="w-4 h-4" />
                      {t('profile.retakeFace', 'Retake Photo')}
                    </button>
                    <button type="button" onClick={() => setFaceImage('')} className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline">
                      {t('profile.removeFace', 'Remove')}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                {t('profile.faceHint', 'Used for face verification when you log in.')}
              </p>
            </div>

            {/* Hidden canvas for face capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Biometric Login Section */}
            <div className="pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint className="w-4 h-4 text-primary-800" />
                <h4 className="text-sm font-bold text-gray-800">
                  {t('profile.biometricLogin', 'Biometric Login')}
                </h4>
                {biometricRegistered && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                    {t('profile.enabled', 'Enabled')}
                  </span>
                )}
              </div>

              {biometricRegistered ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <Fingerprint className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      {t('profile.biometricActive', 'Biometric login is active')}
                    </p>
                    <p className="text-xs text-green-600">
                      {t('profile.biometricActiveDesc', 'You can login using fingerprint or Face ID')}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleBiometricRegister}
                  disabled={biometricLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-accent-300 bg-accent-50 text-accent-700 font-semibold text-sm hover:bg-accent-100 transition-colors"
                  style={{ minHeight: '48px' }}
                >
                  {biometricLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  {biometricLoading
                    ? t('profile.settingUp', 'Setting up...')
                    : t('profile.enableBiometric', 'Enable Fingerprint / Face ID Login')}
                </button>
              )}

              {biometricMsg && (
                <p className={`text-xs mt-2 ${biometricRegistered ? 'text-green-600' : 'text-red-500'}`}>
                  {biometricMsg}
                </p>
              )}

              <p className="text-xs text-gray-400 mt-2">
                {t('profile.biometricHint', 'Use your device biometric (fingerprint or Face ID) to login without password.')}
              </p>
            </div>

            <SectionHeader icon={User} title={t('register.personalInfo')} />

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.name')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="input-field pl-11"
                  style={{ minHeight: '48px' }}
                />
              </div>
            </div>

            {/* Phone (read-only) */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.phone')}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  readOnly
                  className="input-field pl-11 bg-gray-50 text-gray-500 cursor-not-allowed"
                  style={{ minHeight: '48px' }}
                />
              </div>
            </div>

            {/* Aadhaar Number */}
            <div>
              <label
                htmlFor="aadhaarNumber"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('register.aadhaar')}
                <span className="text-xs text-gray-400 ml-1">{t('profile.aadhaarOptional')}</span>
              </label>
              {!editingAadhaar && form.aadhaarNumber ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={maskAadhaar(form.aadhaarNumber)}
                      readOnly
                      className="input-field pl-11 bg-gray-50 text-gray-500 cursor-not-allowed"
                      style={{ minHeight: '48px' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingAadhaar(true)}
                    className="px-4 py-2 text-sm font-semibold text-primary-800 border border-primary-300 rounded-lg hover:bg-primary-50"
                    style={{ minHeight: '48px' }}
                  >
                    {t('profile.edit')}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="aadhaarNumber"
                    name="aadhaarNumber"
                    type="text"
                    inputMode="numeric"
                    value={formatAadhaarDisplay(form.aadhaarNumber)}
                    onChange={handleAadhaarChange}
                    className="input-field pl-11"
                    style={{ minHeight: '48px' }}
                    maxLength={14}
                    placeholder="XXXX XXXX XXXX"
                  />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {t('profile.aadhaarHint')}
              </p>
            </div>
          </div>

          {/* Location Card */}
          <div className="card space-y-4">
            <SectionHeader icon={MapPin} title={t('register.locationInfo')} />

            {/* GPS Auto-detect */}
            <div>
              <button
                type="button"
                onClick={detectGPS}
                disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 text-primary-800 font-semibold text-sm hover:bg-primary-100 transition-colors"
                style={{ minHeight: '48px' }}
              >
                {gpsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                {gpsLoading
                  ? t('profile.detectingLocation')
                  : location.lat
                  ? t('profile.redetectGPS')
                  : t('profile.autoDetectGPS')}
              </button>
              {gpsError && (
                <p className="text-xs text-red-500 mt-1">{gpsError}</p>
              )}
              {location.lat && location.lon && (
                <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
                  <p className="font-medium text-green-800">
                    {t('profile.locationDetected')}
                  </p>
                  <p className="text-green-700 text-xs mt-1">
                    Lat: {location.lat}, Lon: {location.lon}
                  </p>
                  {location.address && (
                    <p className="text-green-600 text-xs mt-1 break-words">
                      {location.address}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* District */}
            <div>
              <label
                htmlFor="district"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.district')}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="district"
                  name="district"
                  type="text"
                  value={form.district}
                  onChange={handleChange}
                  className="input-field pl-11"
                  style={{ minHeight: '48px' }}
                  placeholder="e.g. Pune, Warangal"
                />
              </div>
            </div>

            {/* State */}
            <div>
              <label
                htmlFor="state"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.state')}
              </label>
              <div className="relative">
                <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className="input-field pl-11 appearance-none"
                  style={{ minHeight: '48px' }}
                >
                  <option value="">{t('profile.selectState')}</option>
                  {STATE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {translateState(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Farm Details Card */}
          <div className="card space-y-4">
            <SectionHeader icon={Wheat} title={t('register.farmDetails')} />

            {/* Primary Crop */}
            <div>
              <label
                htmlFor="primaryCrop"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.crop')}
              </label>
              <div className="relative">
                <Sprout className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="primaryCrop"
                  name="primaryCrop"
                  value={form.primaryCrop}
                  onChange={handleChange}
                  className="input-field pl-11 appearance-none"
                  style={{ minHeight: '48px' }}
                >
                  <option value="">{t('advisory.selectCrop')}</option>
                  {CROP_OPTIONS.map((crop) => (
                    <option key={crop} value={crop}>
                      {translateCrop(crop)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Soil Type */}
            <div>
              <label
                htmlFor="soilType"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.soil')}
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="soilType"
                  name="soilType"
                  value={form.soilType}
                  onChange={handleChange}
                  className="input-field pl-11 appearance-none"
                  style={{ minHeight: '48px' }}
                >
                  <option value="">{t('advisory.selectSoil')}</option>
                  {SOIL_OPTIONS.map((soil) => (
                    <option key={soil} value={soil}>
                      {translateSoil(soil)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Land Holding */}
            <div>
              <label
                htmlFor="landHolding"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                {t('profile.landHolding')}
              </label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="landHolding"
                  name="landHolding"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={form.landHolding}
                  onChange={handleChange}
                  className="input-field pl-11"
                  style={{ minHeight: '48px' }}
                  placeholder={t('profile.landPlaceholder')}
                />
              </div>
            </div>

            {/* Language */}
            <div>
              <label
                htmlFor="language"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  {t('profile.language')}
                </span>
              </label>
              <select
                id="language"
                name="language"
                value={form.language}
                onChange={handleLanguageChange}
                className="input-field"
                style={{ minHeight: '48px' }}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Alert Preferences */}
          <div className="card">
            <SectionHeader icon={Bell} title={t('register.alertPreferences')} />

            <div className="divide-y divide-gray-100">
              <ToggleSwitch
                enabled={alertPrefs.sms}
                onToggle={() => handleToggle('sms')}
                label={t('profile.sms')}
              />
              <ToggleSwitch
                enabled={alertPrefs.whatsapp}
                onToggle={() => handleToggle('whatsapp')}
                label={t('profile.whatsapp')}
              />
              <ToggleSwitch
                enabled={alertPrefs.voice}
                onToggle={() => handleToggle('voice')}
                label={t('profile.voice')}
              />
              <ToggleSwitch
                enabled={alertPrefs.push}
                onToggle={() => handleToggle('push')}
                label={t('profile.pushNotifications')}
              />
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-alert-red text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-primary-800 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {success}
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            style={{ minHeight: '48px' }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('profile.save')}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
