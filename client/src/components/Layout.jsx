import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useFarm } from '../context/FarmContext';
import AppLogo from './AppLogo';
import CallMeButton from './CallMeButton';
import {
  LayoutDashboard,
  Sprout,
  CloudSun,
  IndianRupee,
  Landmark,
  Newspaper,
  Mic,
  AlertTriangle,
  ShieldCheck,
  User,
  LogOut,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getUnreadCount } from '../services/notificationService';

// ---- Navigation items ----
const NAV_ITEMS = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/advisory', labelKey: 'nav.advisory', icon: Sprout },
  { path: '/weather', labelKey: 'nav.weather', icon: CloudSun },
  { path: '/prices', labelKey: 'nav.prices', icon: IndianRupee },
  { path: '/schemes', labelKey: 'nav.schemes', icon: Landmark },
  { path: '/news', labelKey: 'nav.news', icon: Newspaper },
  { path: '/chatbot', labelKey: 'nav.chatbot', icon: Mic },
  { path: '/emergency', labelKey: 'nav.emergency', icon: AlertTriangle },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
];

export default function Layout() {
  const { t } = useTranslation();
  const { user, language, setLanguage, logout } = useFarm();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count periodically
  useEffect(() => {
    const fetchCount = () => {
      getUnreadCount()
        .then((res) => setUnreadCount(res.data?.unreadCount || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // every 60s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    setLanguage(lang);
    localStorage.setItem('krishisathi-lang', lang);
  };

  const closeSidebar = () => setSidebarOpen(false);

  // Determine if user is admin
  const isAdmin = user?.role === 'admin';

  // Build full nav list (conditionally include admin)
  const navItems = isAdmin
    ? [...NAV_ITEMS, { path: '/admin', labelKey: 'nav.admin', icon: ShieldCheck }]
    : NAV_ITEMS;

  // Bottom nav shows first 5 items on mobile for space
  const bottomNavItems = NAV_ITEMS.slice(0, 5);

  return (
    <div className="flex h-screen bg-[#FAFDF6]">
      {/* ======== Desktop Sidebar ======== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200 shadow-sm">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <AppLogo size="sm" />
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map(({ path, labelKey, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-green-50 text-[#2E7D32] border-l-4 border-[#2E7D32]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{t(labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-50 text-[#2E7D32]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <User className="w-5 h-5" />
            <span>{t('nav.profile')}</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* ======== Mobile Sidebar Overlay ======== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeSidebar}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
            {/* Logo + close */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <AppLogo size="sm" />
              <button
                onClick={closeSidebar}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              <ul className="space-y-1">
                {navItems.map(({ path, labelKey, icon: Icon }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      end={path === '/'}
                      onClick={closeSidebar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-green-50 text-[#2E7D32] border-l-4 border-[#2E7D32]'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{t(labelKey)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Footer */}
            <div className="border-t border-gray-100 p-4 space-y-3">
              <NavLink
                to="/profile"
                onClick={closeSidebar}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <User className="w-5 h-5" />
                <span>{t('nav.profile')}</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ======== Main content area ======== */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* ---- Header ---- */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            {/* Left: hamburger (mobile) + page area */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              {/* Mobile logo */}
              <div className="lg:hidden">
                <AppLogo size="sm" />
              </div>
            </div>

            {/* Right: language switcher + user info */}
            <div className="flex items-center gap-4">
              {/* Language switcher */}
              <select
                value={language}
                onChange={handleLanguageChange}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] outline-none cursor-pointer"
                aria-label="Select language"
              >
                {LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>

              {/* Notification bell */}
              <NavLink
                to="/notifications"
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label={t('nav.notifications')}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>

              {/* User avatar + name */}
              <NavLink
                to="/profile"
                className="hidden sm:flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="w-8 h-8 bg-[#2E7D32] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                  {user?.name || 'Farmer'}
                </span>
              </NavLink>
            </div>
          </div>
        </header>

        {/* ---- Page content ---- */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6">
            <Outlet />
          </div>
        </main>

        {/* ---- Footer (desktop) ---- */}
        <footer className="hidden lg:block border-t border-gray-200 bg-white px-6 py-3">
          <p className="text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} KrishiSathi. All rights reserved.
          </p>
        </footer>

        {/* ======== Floating Call Me Button ======== */}
        <CallMeButton />

        {/* ======== Mobile Bottom Nav ======== */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg lg:hidden z-40">
          <div className="flex items-center justify-around py-2 px-1">
            {bottomNavItems.map(({ path, labelKey, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] transition-colors ${
                    isActive
                      ? 'text-[#2E7D32]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">
                  {t(labelKey)}
                </span>
              </NavLink>
            ))}
            {/* More / Menu button on mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{t('nav.more', 'More')}</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
