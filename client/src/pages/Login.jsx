import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { login as loginService } from '../services/authService';
import { Phone, Lock, Loader2, Sprout } from 'lucide-react';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useFarm();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
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
      setError(
        err?.response?.data?.message ||
          t('common.error', 'Something went wrong')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 mb-4">
          <Sprout className="w-10 h-10 text-primary-800" />
        </div>
        <h1 className="text-3xl font-bold text-primary-800">
          {t('app.name')}
        </h1>
        <p className="text-gray-600 mt-1">{t('app.tagline')}</p>
      </div>

      {/* Login Card */}
      <div className="card w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
          {t('auth.login')}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              {t('auth.phone')}
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field pl-11"
                maxLength={10}
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
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-11"
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('auth.login')
            )}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-gray-600 mt-6">
          {t('auth.noAccount')}{' '}
          <Link
            to="/register"
            className="text-primary-800 font-semibold hover:underline"
          >
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
