import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../common/LanguageSelector';

interface HeaderProps {
  onMenuToggle: () => void;
  isMobile: boolean;
  isSidebarCollapsed: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, isMobile, isSidebarCollapsed }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const pageMeta = useMemo(() => {
    const routes = [
      { path: '/patients', title: t('patients.patients'), description: t('patients.searchPatients') },
      { path: '/new-consultation', title: t('consultation.newConsultation'), description: t('consultation.recordAndAnalyze') },
      { path: '/past-consultations', title: t('navigation.pastConsultations'), description: t('dashboard.recentPatients') },
      { path: '/reports', title: t('reports.reports'), description: t('reports.manageAndDownload') },
      { path: '/settings', title: t('settings.settings'), description: t('settings.manageAccountSettings') },
      { path: '/pricing', title: t('pricing.pricing'), description: t('subscription.chooseTheRightPlan') },
      { path: '/super-admin', title: t('superAdmin.superAdmin'), description: t('superAdmin.overview') },
      { path: '/', title: t('dashboard.dashboardOverview'), description: t('dashboard.recentPatients'), end: true }
    ];

    return routes.find(({ path, end }) => matchPath({ path, end: end ?? false }, location.pathname)) || {
      title: t('common.clinixAi'),
      description: t('common.audioToMedicalReports')
    };
  }, [location.pathname, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const containerClassName = isSidebarCollapsed && !isMobile
    ? 'w-full px-4 py-2.5 transition-[padding] duration-300 sm:px-6 sm:py-3 lg:px-8 xl:px-10'
    : 'page-container py-2.5 sm:py-3';

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className={containerClassName}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {(isMobile || isSidebarCollapsed) && (
              <button
                onClick={onMenuToggle}
                className="btn-ghost rounded-xl p-1.5"
                aria-label={t('common.openNavigation')}
              >
                <Menu size={20} />
              </button>
            )}

            {!isMobile && (
              <div className="hidden min-w-0 flex-col lg:flex">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-600">Clinix AI</span>
                <h1 className="truncate text-base font-bold text-slate-900">{pageMeta.title}</h1>
                <p className="truncate text-xs text-slate-500">{pageMeta.description}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector />

            <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-slate-300 hover:shadow-soft"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white shadow-soft">
                <User size={16} />
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {user?.role === 'super_admin'
                    ? t('superAdmin.superAdmin')
                    : user?.role === 'admin'
                    ? t('superAdmin.admin')
                    : t('superAdmin.doctor')}
                </p>
              </div>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                <div className="border-b border-slate-100 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="py-2">
                  <Link to="/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                    <Settings size={16} />
                    {t('common.settings')}
                  </Link>
                  <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-error-600 transition-colors hover:bg-error-50">
                    <LogOut size={16} />
                    {t('auth.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;