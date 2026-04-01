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
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import Logo from '../common/Logo';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
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
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col w-64 bg-white border-r h-full">
      <div className="flex items-center justify-between h-16 border-b px-4">
        <Logo />
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="p-4 space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-700 bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;