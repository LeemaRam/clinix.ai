import React, { useState } from 'react';
import { Bell, Search, User, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../common/LanguageSelector';

interface HeaderProps {
  onMenuToggle: () => void;
  isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, isMobile }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm py-3 px-4 sm:px-6">
      <div className={`flex items-center ${isMobile ? 'justify-between' : 'justify-end'} w-full`}>
        {/* Mobile menu button */}
        {isMobile && (
          <button
            onClick={onMenuToggle}
            className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none lg:hidden"
          >
            <Menu size={24} />
          </button>
        )}
        
        {/* Spacer for mobile layout */}
        <div className={isMobile ? 'flex-1' : 'hidden'} />
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          <LanguageSelector />
          {/* <button className="relative p-2 text-gray-500 hover:text-gray-700 focus:outline-none">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button> */}

          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-2 sm:space-x-3 focus:outline-none"
            >
              <div className="w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-white">
                <User size={18} />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-700">{user?.full_name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'super_admin' ? t('superAdmin.superAdmin') : 
                   user?.role === 'admin' ? t('superAdmin.admin') : 
                   t('superAdmin.doctor')}
                </p>
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                <Link to="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  {t('common.settings')}
                </Link>
                <button onClick={logout} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;