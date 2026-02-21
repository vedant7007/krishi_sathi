import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import {
  login as loginService,
  faceLogin as faceLoginService,
  webauthnLoginOptions,
  webauthnLoginVerify,
} from '../services/authService';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  Phone, Lock, Loader2, CheckCircle, Camera, ShieldCheck,
  Fingerprint, ScanFace, ArrowLeft,
} from 'lucide-react';
import AppLogo from '../components/AppLogo';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useFarm();

  // Which view: 'main' | 'phone' | 'face' | 'biometric'
  const [view, setView] = useState('main');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Face login state
  const [faceStep, setFaceStep] = useState(null); // null | 'capture' | 'verifying' | 'verified' | 'failed'
  const [pendingAuth, setPendingAuth] = useState(null);
  const [liveFace, setLiveFace] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start camera when face capture view is active
  useEffect(() => {
    if (view === 'face' && faceStep === 'capture') {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, faceStep]);

  // Auto-redirect after face verified
  useEffect(() => {
    if (faceStep === 'verified' && pendingAuth) {
      const timer = setTimeout(() => {
        login(pendingAuth.token, pendingAuth.user);
        navigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [faceStep, pendingAuth, login, navigate]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 250);
    } catch {
      setError(t('login.cameraError', 'Camera access denied. Please allow camera access.'));
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const goBack = () => {
    stopCamera();
    setView('main');
    setFaceStep(null);
    setError('');
    setLiveFace(null);
    setPendingAuth(null);
  };

  // ─── Face Login: capture → send to server → Gemini matches ───
  const handleFaceLogin = () => {
    setError('');
    setView('face');
    setFaceStep('capture');
  };

  const captureAndMatch = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setLiveFace(dataUrl);
    stopCamera();

    setFaceStep('verifying');
    try {
      const res = await faceLoginService(dataUrl);
      setPendingAuth({ token: res.data.token, user: res.data.user });
      setFaceStep('verified');
    } catch (err) {
      setFaceStep('failed');
      setError(
        err?.response?.data?.message || t('login.faceNotRecognized', 'Face not recognized. Try again.')
      );
    }
  };

  const retryFaceCapture = () => {
    setError('');
    setLiveFace(null);
    setFaceStep('capture');
  };

  // ─── Biometric Login (WebAuthn / Passkeys) ───
  const handleBiometricLogin = async () => {
    setError('');
    setView('biometric');
    setLoading(true);
    try {
      // 1. Get authentication options from server
      const optionsRes = await webauthnLoginOptions();
      const { sessionKey, ...options } = optionsRes.data;

      // 2. Start authentication (triggers fingerprint / Face ID prompt)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Verify with server
      const verifyRes = await webauthnLoginVerify({ ...authResponse, sessionKey });
      login(verifyRes.data.token, verifyRes.data.user);
      navigate('/');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('login.biometricFailed', 'Biometric login failed. Use another method.');
      setError(msg);
      setView('main');
    } finally {
      setLoading(false);
    }
  };

  // ─── Traditional Phone/Password Login ───
  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || !password) {
      setError(t('auth.fillAllFields', 'Please fill all fields'));
      return;
    }
    setLoading(true);
    try {
      const res = await loginService({ phone, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // FACE LOGIN SCREEN
  // ════════════════════════════════════════════════════════
  if (view === 'face') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="card w-full max-w-md text-center">
          {/* Back button */}
          <button onClick={goBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Step: Capture */}
          {faceStep === 'capture' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <ScanFace className="w-7 h-7 text-primary-800" />
                <h2 className="text-lg font-bold text-gray-900">
                  {t('login.faceLogin', 'Face Login')}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('login.faceLoginHint', 'Position your face in the frame and tap capture')}
              </p>

              {/* Camera feed */}
              <div className="relative mx-auto rounded-2xl overflow-hidden bg-black mb-4" style={{ maxWidth: '280px' }}>
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  className="w-full rounded-2xl"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-44 border-2 border-dashed border-white/50 rounded-full" />
                </div>
              </div>

              <button onClick={captureAndMatch} className="btn-primary px-8 mx-auto">
                <Camera className="w-5 h-5" />
                {t('login.capture', 'Capture & Login')}
              </button>
            </>
          )}

          {/* Step: Verifying */}
          {faceStep === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-8">
              {liveFace && (
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-200 shadow-lg">
                  <img src={liveFace} alt="You" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </div>
              )}
              <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
              <p className="text-sm font-semibold text-gray-700">
                {t('login.matchingFace', 'Matching your face...')}
              </p>
              <p className="text-xs text-gray-400">
                {t('login.aiPowered', 'AI-powered face recognition')}
              </p>
            </div>
          )}

          {/* Step: Verified — match found */}
          {faceStep === 'verified' && pendingAuth && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                {liveFace && (
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-400 shadow-lg">
                    <img src={liveFace} alt="You" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  </div>
                )}
                <CheckCircle className="absolute -bottom-1 -right-1 w-8 h-8 text-green-500 bg-white rounded-full" />
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm font-bold">{t('login.verified', 'Identity Confirmed')}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {t('login.welcomeBack', 'Welcome back,')}{' '}{pendingAuth.user.name}!
              </h3>
              <p className="text-xs text-gray-500">{t('login.redirecting', 'Redirecting to home...')}</p>
            </div>
          )}

          {/* Step: Failed — no match */}
          {faceStep === 'failed' && (
            <div className="flex flex-col items-center gap-4 py-8">
              {liveFace && (
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-red-300 shadow-lg">
                  <img src={liveFace} alt="You" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </div>
              )}
              {error && (
                <p className="text-sm text-alert-red font-medium">{error}</p>
              )}
              <div className="flex gap-3">
                <button onClick={retryFaceCapture} className="btn-primary px-6">
                  <Camera className="w-4 h-4" />
                  {t('login.tryAgain', 'Try Again')}
                </button>
                <button onClick={goBack} className="btn-outline px-4 text-sm">
                  {t('login.otherMethods', 'Other Methods')}
                </button>
              </div>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // BIOMETRIC LOADING SCREEN
  // ════════════════════════════════════════════════════════
  if (view === 'biometric') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="card w-full max-w-md text-center py-12">
          <Fingerprint className="w-16 h-16 text-primary-800 mx-auto mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {t('login.biometricPrompt', 'Use your biometric')}
          </h2>
          <p className="text-sm text-gray-500">
            {t('login.biometricHint', 'Touch the fingerprint sensor or use Face ID')}
          </p>
          {loading && <Loader2 className="w-6 h-6 text-primary-800 animate-spin mx-auto mt-4" />}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // PHONE LOGIN FORM
  // ════════════════════════════════════════════════════════
  if (view === 'phone') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center mb-8">
          <AppLogo size="lg" />
          <p className="text-gray-500 text-sm mt-2">{t('app.tagline')}</p>
        </div>

        <div className="card w-full max-w-md relative">
          <button onClick={goBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            {t('auth.loginWithPhone', 'Login with Phone')}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-alert-red text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1">
                {t('auth.phone')}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="phone" type="tel" inputMode="numeric" placeholder="9876543210"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="input-field pl-11" maxLength={10} autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password" type="password" placeholder="********"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11" autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.login')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary-800 font-semibold hover:underline">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // MAIN LOGIN SCREEN — choose login method
  // ════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Branding */}
      <div className="flex flex-col items-center mb-8">
        <AppLogo size="lg" />
        <p className="text-gray-500 text-sm mt-2">{t('app.tagline')}</p>
      </div>

      <div className="card w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
          {t('auth.login')}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          {t('login.chooseMethod', 'Choose how you want to sign in')}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Face Login */}
          <button
            onClick={handleFaceLogin}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-primary-200 bg-primary-50 hover:bg-primary-100 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary-800 flex items-center justify-center flex-shrink-0">
              <ScanFace className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{t('login.faceLogin', 'Face Login')}</p>
              <p className="text-xs text-gray-500">{t('login.faceLoginDesc', 'Login using your face — no password needed')}</p>
            </div>
          </button>

          {/* Biometric Login */}
          <button
            onClick={handleBiometricLogin}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-accent-200 bg-accent-50 hover:bg-accent-100 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-accent-600 flex items-center justify-center flex-shrink-0">
              <Fingerprint className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{t('login.biometricLogin', 'Biometric Login')}</p>
              <p className="text-xs text-gray-500">{t('login.biometricDesc', 'Fingerprint or Face ID from your device')}</p>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase">{t('common.or', 'or')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Phone Login */}
          <button
            onClick={() => { setError(''); setView('phone'); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <Phone className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{t('auth.loginWithPhone', 'Login with Phone')}</p>
              <p className="text-xs text-gray-500">{t('login.phoneDesc', 'Use phone number and password')}</p>
            </div>
          </button>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-gray-600 mt-6">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-primary-800 font-semibold hover:underline">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
