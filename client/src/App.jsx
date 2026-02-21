import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { FarmProvider, useFarm } from './context/FarmContext';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';

// ---- Lazy-loaded page components ----
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CropAdvisory = lazy(() => import('./pages/CropAdvisory'));
const Weather = lazy(() => import('./pages/Weather'));
const MarketPrices = lazy(() => import('./pages/MarketPrices'));
const Schemes = lazy(() => import('./pages/Schemes'));
const News = lazy(() => import('./pages/News'));
const VoiceChatbot = lazy(() => import('./pages/VoiceChatbot'));
const Emergency = lazy(() => import('./pages/Emergency'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));

// ---- Loading fallback ----
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FAFDF6]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

// ---- Protected Route wrapper ----
function ProtectedRoute() {
  const { token } = useFarm();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// ---- App ----
function App() {
  return (
    <FarmProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/advisory" element={<CropAdvisory />} />
                <Route path="/weather" element={<Weather />} />
                <Route path="/prices" element={<MarketPrices />} />
                <Route path="/schemes" element={<Schemes />} />
                <Route path="/news" element={<News />} />
                <Route path="/chatbot" element={<VoiceChatbot />} />
                <Route path="/emergency" element={<Emergency />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </FarmProvider>
  );
}

export default App;
