import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  User,
  Lock,
  Settings as SettingsIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Settings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password state 
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Language state
  const [language, setLanguage] = useState('en');
  const [languageLoading, setLanguageLoading] = useState(false);
  const [languageError, setLanguageError] = useState('');
  const [languageSuccess, setLanguageSuccess] = useState('');

  const tabs = [
    { id: 'profile', label: t('settings.profile'), icon: <User size={20} /> },
    { id: 'security', label: t('settings.security'), icon: <Lock size={20} /> },
    { id: 'language', label: t('settings.language'), icon: <SettingsIcon size={20} /> },
  ];

  // Fetch functions for each tab
  const fetchProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setProfile({
        fullName: res.data.fullName || '',
        email: res.data.email || '',
        phone: res.data.phone || ''
      });
    } catch (err) {
      setProfileError(t('settings.failedToLoadProfile'));
    }
    setProfileLoading(false);
  };

  const fetchLanguage = async () => {
    setLanguageLoading(true);
    setLanguageError('');
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/language`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setLanguage(res.data.language || 'en');
    } catch (err) {
      setLanguageError(t('settings.failedToLoadLanguage'));
    }
    setLanguageLoading(false);
  };

  // Handle tab change and fetch corresponding data
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);

    // Reset all success/error messages when changing tabs
    setProfileSuccess('');
    setProfileError('');
    setPasswordSuccess('');
    setPasswordError('');
    setLanguageSuccess('');
    setLanguageError('');

    // Fetch data based on selected tab
    switch (tabId) {
      case 'profile':
        fetchProfile();
        break;
      case 'language':
        fetchLanguage();
        break;
      // No initial fetch needed for security tab as it's form-based
      default:
        break;
    }
  };

  // Fetch initial data on mount
  useEffect(() => {
    if (activeTab === 'profile') {
      fetchProfile();
    } else if (activeTab === 'language') {
      fetchLanguage();
    }
  }, []);

  // Handlers for controlled components
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.id]: e.target.value });
  };

  const handlePasswordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords({ ...passwords, [e.target.id]: e.target.value });
  };

  // Profile submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/user/profile`, profile, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setProfileSuccess(t('settings.profileUpdated'));
    } catch (err) {
      setProfileError(t('settings.failedToUpdateProfile'));
    }
    setProfileLoading(false);
  };

  // Password submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');
    if (passwords.new !== passwords.confirm) {
      setPasswordError(t('settings.passwordsDoNotMatch'));
      setPasswordLoading(false);
      return;
    }
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/user/change-password`, {
        currentPassword: passwords.current,
        newPassword: passwords.new
      },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      setPasswordSuccess(t('settings.passwordChanged'));
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPasswordError(t('settings.failedToChangePassword'));
    }
    setPasswordLoading(false);
  };

  // Language change
  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setLanguageLoading(true);
    setLanguageError('');
    setLanguageSuccess('');
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/user/language`, { language: newLang }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setLanguageSuccess(t('settings.languageUpdated'));
    } catch (err) {
      setLanguageError(t('settings.failedToUpdateLanguage'));
    }
    setLanguageLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('settings.settings')}</h1>
        <p className="text-gray-600">{t('settings.manageAccountSettings')}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200">
            <nav className="p-4">
              <ul className="space-y-1">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <span className="mr-3">{tab.icon}</span>
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex-1 p-6">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('settings.profileSettings')}</h2>
                <form onSubmit={handleProfileSubmit}>
                  {profileError && <div className="text-red-500 mb-2">{profileError}</div>}
                  {profileSuccess && <div className="text-green-600 mb-2">{profileSuccess}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.fullName')}
                      </label>
                      <input
                        type="text"
                        id="fullName"
                        value={profile.fullName}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        disabled={profileLoading}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.emailAddress')}
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={profile.email}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        disabled={profileLoading}
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.phoneNumber')}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={profile.phone}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        disabled={profileLoading}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                    disabled={profileLoading}
                  >
                    {profileLoading ? t('settings.saving') : t('settings.saveChanges')}
                  </button>
                </form>
              </div>
            )}
            {activeTab === 'security' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('settings.changePassword')}</h2>
                <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-6">
                  {passwordError && <div className="text-red-500 mb-2">{passwordError}</div>}
                  {passwordSuccess && <div className="text-green-600 mb-2">{passwordSuccess}</div>}
                  <div>
                    <label htmlFor="current" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.currentPassword')}
                    </label>
                    <input
                      type="password"
                      id="current"
                      value={passwords.current}
                      onChange={handlePasswordsChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      required
                      disabled={passwordLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="new" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.newPassword')}
                    </label>
                    <input
                      type="password"
                      id="new"
                      value={passwords.new}
                      onChange={handlePasswordsChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      required
                      disabled={passwordLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.confirmNewPassword')}
                    </label>
                    <input
                      type="password"
                      id="confirm"
                      value={passwords.confirm}
                      onChange={handlePasswordsChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      required
                      disabled={passwordLoading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? t('settings.changing') : t('settings.changePassword')}
                  </button>
                </form>
              </div>
            )}
            {activeTab === 'language' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('settings.languageSettings')}</h2>
                <form className="max-w-sm space-y-6">
                  {languageError && <div className="text-red-500 mb-2">{languageError}</div>}
                  {languageSuccess && <div className="text-green-600 mb-2">{languageSuccess}</div>}
                  <div>
                    <label htmlFor="languageSelect" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.selectLanguage')}
                    </label>
                    <select
                      id="languageSelect"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      value={language}
                      onChange={handleLanguageChange}
                      disabled={languageLoading}
                    >
                      <option value="en">{t('settings.english')}</option>
                      <option value="es">{t('settings.spanish')}</option>
                    </select>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;