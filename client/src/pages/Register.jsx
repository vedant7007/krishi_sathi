import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/authService';
import { translateCrop, translateSoil, translateState } from '../utils/translate';
import AppLogo from '../components/AppLogo';
import {
  User,
  Phone,
  Lock,
  MapPin,
  Sprout,
  Loader2,
  Landmark,
  Ruler,
  Bell,
  Navigation,
  Shield,
  Wheat,
  Layers,
  Globe,
  Camera,
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
  // 28 States
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
  // 8 Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
];

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-2">
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary-800" />
      </div>
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
    </div>
  );
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

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedLanguage, setSelectedLanguage] = useState(
    i18n.language || 'en'
  );

  const [role, setRole] = useState('farmer');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    aadhaarNumber: '',
    district: '',
    state: '',
    primaryCrop: '',
    soilType: '',
    landHolding: '',
    department: '',
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

  const [faceImage, setFaceImage] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('krishisathi-lang', lang);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  const openCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Wait for the video element to be rendered
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setFaceImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setFaceImage('');
    openCamera();
  }, [openCamera]);

  const detectGPS = () => {
    if (!navigator.geolocation) {
      setGpsError(t('register.gpsNotSupported'));
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

          // Auto-fill district and state from reverse geocoding
          if (data.address) {
            const district = data.address.state_district || data.address.county || data.address.city || '';
            const state = data.address.state || '';
            if (district || state) {
              setForm((prev) => ({
                ...prev,
                district: prev.district || district,
                state: prev.state || (STATE_OPTIONS.find((s) => s.toLowerCase() === state.toLowerCase()) || prev.state),
              }));
            }
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
            ? t('register.gpsDenied')
            : t('register.gpsError')
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const requiredFields = ['name', 'phone', 'password', 'confirmPassword'];
    for (const field of requiredFields) {
      if (!form[field]) {
        setError(t('register.fillRequired'));
        return;
      }
    }

    if (form.password !== form.confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }

    if (form.phone.length < 10) {
      setError(t('register.invalidPhone'));
      return;
    }

    if (!form.aadhaarNumber || form.aadhaarNumber.length !== 12) {
      setError(t('register.aadhaarInvalid', 'Please enter a valid 12-digit Aadhaar number'));
      return;
    }

    if (!faceImage) {
      setError(t('register.faceRequired', 'Please capture your face photo'));
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, department, ...payload } = form;
      payload.role = role;
      if (role === 'farmer') {
        payload.landHolding = payload.landHolding
          ? Number(payload.landHolding)
          : undefined;
      } else {
        // Admin doesn't need farm details
        delete payload.primaryCrop;
        delete payload.soilType;
        delete payload.landHolding;
      }
      if (location.lat && location.lon) {
        payload.location = {
          lat: Number(location.lat),
          lon: Number(location.lon),
          address: location.address || '',
        };
      }

      payload.alertPreferences = alertPrefs;
      payload.language = selectedLanguage;
      if (faceImage) payload.faceImage = faceImage;

      await register(payload);
      navigate('/login');
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          t('common.error')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4">
      {/* Branding */}
      <div className="flex flex-col items-center mb-6">
        <AppLogo size="lg" />
        <p className="text-sm text-gray-500 mt-2">{t('register.createAccount')}</p>
      </div>

      {/* Registration Card */}
      <div className="card w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
          {t('auth.register')}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ====== LANGUAGE SELECTOR ====== */}
          <div>
            <SectionHeader icon={Globe} title={t('register.selectLanguage')} />
            <select
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="input-field"
              style={{ minHeight: '48px' }}
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <hr className="border-gray-200" />

          {/* ====== ROLE SELECTOR ====== */}
          <div>
            <SectionHeader icon={Shield} title={t('register.selectRole', 'I am a...')} />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  role === 'farmer'
                    ? 'border-primary-800 bg-primary-50 text-primary-800'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
                style={{ minHeight: '48px' }}
              >
                <Wheat className="w-8 h-8" />
                <span className="text-sm font-bold">{t('register.roleFarmer', 'Farmer')}</span>
                <span className="text-xs text-center opacity-75">{t('register.roleFarmerDesc', 'Get crop advisory, weather & prices')}</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  role === 'admin'
                    ? 'border-primary-800 bg-primary-50 text-primary-800'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
                style={{ minHeight: '48px' }}
              >
                <Shield className="w-8 h-8" />
                <span className="text-sm font-bold">{t('register.roleAdmin', 'Admin / Official')}</span>
                <span className="text-xs text-center opacity-75">{t('register.roleAdminDesc', 'Manage alerts, schemes & data')}</span>
              </button>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* ====== PERSONAL INFO SECTION ====== */}
          <div>
            <SectionHeader icon={User} title={t('register.personalInfo')} />
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  {t('profile.name')} <span className="text-red-500">*</span>
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
                    placeholder={t('register.namePlaceholder')}
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  {t('auth.phone')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={handleChange}
                    className="input-field pl-11"
                    style={{ minHeight: '48px' }}
                    maxLength={10}
                    placeholder={t('register.phonePlaceholder')}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  {t('auth.password')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    className="input-field pl-11"
                    style={{ minHeight: '48px' }}
                    placeholder={t('register.passwordPlaceholder')}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  {t('auth.confirmPassword')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="input-field pl-11"
                    style={{ minHeight: '48px' }}
                    placeholder={t('register.confirmPlaceholder')}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Aadhaar Number */}
              <div>
                <label
                  htmlFor="aadhaarNumber"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  {t('register.aadhaar')} <span className="text-red-500">*</span>
                </label>
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
                <p className="text-xs text-gray-400 mt-1">
                  {t('register.aadhaarHint')}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* ====== FACE CAPTURE SECTION ====== */}
          <div>
            <SectionHeader icon={Camera} title={t('register.faceCapture', 'Face Photo')} />
            <p className="text-xs text-gray-500 mb-3">
              {t('register.faceCaptureHint', 'Capture your face photo for identity verification at login.')} <span className="text-red-500 font-semibold">*</span>
            </p>

            {!faceImage && !cameraOpen && (
              <button
                type="button"
                onClick={openCamera}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 text-primary-800 font-semibold text-sm hover:bg-primary-100 transition-colors"
                style={{ minHeight: '48px' }}
              >
                <Camera className="w-5 h-5" />
                {t('register.openCamera', 'Open Camera')}
              </button>
            )}

            {cameraError && (
              <p className="text-xs text-red-500 mt-2">{cameraError}</p>
            )}

            {cameraOpen && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ maxWidth: '320px', margin: '0 auto' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-xl"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg bg-primary-800 text-white font-semibold text-sm hover:bg-primary-900 transition-colors"
                    style={{ minHeight: '40px' }}
                  >
                    <Camera className="w-4 h-4" />
                    {t('register.capture', 'Capture')}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 transition-colors"
                    style={{ minHeight: '40px' }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            )}

            {faceImage && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary-200 shadow-md">
                  <img
                    src={faceImage}
                    alt={t('register.facePreview', 'Captured face')}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 transition-colors"
                    style={{ minHeight: '40px' }}
                  >
                    <Camera className="w-4 h-4" />
                    {t('register.retake', 'Retake')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaceImage('')}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg bg-red-100 text-red-700 font-semibold text-sm hover:bg-red-200 transition-colors"
                    style={{ minHeight: '40px' }}
                  >
                    {t('register.removePhoto', 'Remove')}
                  </button>
                </div>
              </div>
            )}

            {/* Hidden canvas for capturing snapshot */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <hr className="border-gray-200" />

          {/* ====== LOCATION SECTION ====== */}
          <div>
            <SectionHeader icon={MapPin} title={t('register.locationInfo')} />
            <div className="space-y-4">
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
                    ? t('register.detectingLocation')
                    : t('register.detectLocation')}
                </button>
                {gpsError && (
                  <p className="text-xs text-red-500 mt-1">{gpsError}</p>
                )}
                {location.lat && location.lon && (
                  <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
                    <p className="font-medium text-green-800">
                      {t('register.locationDetected')}
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
                    placeholder={t('register.districtPlaceholder')}
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
                    <option value="">{t('register.selectState')}</option>
                    {STATE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {translateState(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* ====== FARM DETAILS (Farmers only) / ADMIN DETAILS ====== */}
          {role === 'farmer' ? (
          <div>
            <SectionHeader icon={Wheat} title={t('register.farmDetails')} />
            <div className="space-y-4">
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
                    placeholder={t('register.landPlaceholder')}
                  />
                </div>
              </div>
            </div>
          </div>
          ) : (
          <div>
            <SectionHeader icon={Shield} title={t('register.adminDetails', 'Admin Details')} />
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <p className="font-semibold">{t('register.adminNote', 'Admin / Government Official Account')}</p>
                <p className="text-xs mt-1 opacity-75">{t('register.adminNoteDesc', 'You will be able to manage crop advisories, send emergency alerts, update market prices, and manage government schemes.')}</p>
              </div>
              <div>
                <label htmlFor="department" className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('register.department', 'Department / Organization')}
                </label>
                <div className="relative">
                  <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    id="department"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    className="input-field pl-11 appearance-none"
                    style={{ minHeight: '48px' }}
                  >
                    <option value="">{t('register.selectDepartment', 'Select Department')}</option>
                    <option value="agriculture">{t('register.deptAgriculture', 'Department of Agriculture')}</option>
                    <option value="weather">{t('register.deptWeather', 'Weather Department (IMD)')}</option>
                    <option value="horticulture">{t('register.deptHorticulture', 'Horticulture Department')}</option>
                    <option value="revenue">{t('register.deptRevenue', 'Revenue Department')}</option>
                    <option value="cooperative">{t('register.deptCooperative', 'Cooperative Society')}</option>
                    <option value="research">{t('register.deptResearch', 'Agricultural Research (ICAR)')}</option>
                    <option value="marketing">{t('register.deptMarketing', 'Agricultural Marketing Board')}</option>
                    <option value="other">{t('register.deptOther', 'Other')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          )}

          <hr className="border-gray-200" />

          {/* ====== ALERT PREFERENCES SECTION ====== */}
          <div>
            <SectionHeader icon={Bell} title={t('register.alertPreferences')} />
            <div className="rounded-xl border border-gray-200 px-4 divide-y divide-gray-100">
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
                label={t('register.pushNotifications')}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
            style={{ minHeight: '48px' }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('auth.register')
            )}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-gray-600 mt-6">
          {t('auth.hasAccount')}{' '}
          <Link
            to="/login"
            className="text-primary-800 font-semibold hover:underline"
          >
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
