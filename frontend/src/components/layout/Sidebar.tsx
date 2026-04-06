import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Users, 
  Mic, 
  FileText, 
  Clock,
  Settings,
  Shield,
  UserCog,
  Globe,
  CreditCard,
  DollarSign,
  X,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import Logo from '../common/Logo';

interface SidebarProps {
  isMobile?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobile = false, isCollapsed = false, onClose }) => {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();

  const regularNavigation = [
    { name: t('navigation.dashboard'), href: '/', icon: Home },
    { name: t('navigation.patients'), href: '/patients', icon: Users },
    { name: t('navigation.newConsultation'), href: '/new-consultation', icon: Mic },
    { name: t('navigation.pastConsultations'), href: '/past-consultations', icon: Clock },
    { name: t('navigation.reports'), href: '/reports', icon: FileText },
    { name: t('navigation.pricing'), href: '/pricing', icon: DollarSign },
    { name: t('navigation.settings'), href: '/settings', icon: Settings },
  ];

  const superAdminNavigation = [
    { name: t('superAdmin.dashboard'), href: '/super-admin', icon: Shield },
    { name: t('superAdmin.userManagement'), href: '/super-admin/users', icon: UserCog },
    { name: t('superAdmin.languageSettings'), href: '/super-admin/languages', icon: Globe },
    { name: t('superAdmin.subscriptionPlans'), href: '/super-admin/subscription-plans', icon: DollarSign },
    { name: t('navigation.settings'), href: '/settings', icon: Settings },
  ];

  const navigation = isSuperAdmin() ? superAdminNavigation : regularNavigation;

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-slate-950 text-white">
      <div className={`flex items-center ${isCollapsed ? 'justify-center px-3 py-4' : 'justify-between px-5 py-4'} border-b border-white/10`}>
        <Logo theme="dark" compact={isCollapsed} />
        {!isCollapsed && onClose && (
          <button
            onClick={onClose}
            className="btn-ghost rounded-xl p-2 text-slate-300 hover:bg-white/5 hover:text-white"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${isCollapsed ? 'px-2 py-4' : 'px-3 py-4'}`}>
        {!isCollapsed && (
          <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {isSuperAdmin() ? t('superAdmin.superAdmin') : t('navigation.dashboard')}
          </div>
        )}
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `group flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-4 py-3'} rounded-2xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10 text-white shadow-soft'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
                title={item.name}
              >
                <span className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </span>
                {!isCollapsed && (
                  <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {!isCollapsed && (
        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Clinix AI Workspace</p>
            <p className="mt-1 leading-relaxed text-slate-400">
              {t('common.audioToMedicalReports')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;