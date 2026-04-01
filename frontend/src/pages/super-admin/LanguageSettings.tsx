import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Globe, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Loader2,
  X,
  Save
} from 'lucide-react';
import { toast } from 'react-toastify';

interface Language {
  code: string;
  name: string;
  enabled: boolean;
  isUILanguage: boolean;
  isSpeechLanguage: boolean;
}

interface SpeechLanguage {
  code: string;
  name: string;
  enabled: boolean;
}

const LanguageSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [uiLanguages, setUiLanguages] = useState<Language[]>([]);
  const [speechLanguages, setSpeechLanguages] = useState<SpeechLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLanguage, setSavingLanguage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLanguage, setNewLanguage] = useState({
    code: '',
    name: '',
    isUILanguage: false,
    isSpeechLanguage: false
  });
  const [defaultLanguage, setDefaultLanguage] = useState('en');

  // Available speech recognition languages
  const availableSpeechLanguages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'ur-PK', name: 'Urdu (Pakistan)' },
  ];

  useEffect(() => {
    fetchLanguageSettings();
  }, []);

  const fetchLanguageSettings = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/super-admin/languages`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setUiLanguages(response.data.uiLanguages || [
        { code: 'en', name: 'English', enabled: true, isUILanguage: true, isSpeechLanguage: false },
        { code: 'ur', name: 'Urdu', enabled: true, isUILanguage: true, isSpeechLanguage: false }
      ]);
      
      setSpeechLanguages(response.data.speechLanguages || [
        { code: 'en-US', name: 'English (US)', enabled: true },
        { code: 'ur-PK', name: 'Urdu (Pakistan)', enabled: true }
      ]);
      
      setDefaultLanguage(response.data.defaultLanguage || 'en');
    } catch (error) {
      console.error('Error fetching language settings:', error);
      // Set default values if API fails
      setUiLanguages([
        { code: 'en', name: 'English', enabled: true, isUILanguage: true, isSpeechLanguage: false },
        { code: 'ur', name: 'Urdu', enabled: true, isUILanguage: true, isSpeechLanguage: false }
      ]);
      setSpeechLanguages([
        { code: 'en-US', name: 'English (US)', enabled: true },
        { code: 'ur-PK', name: 'Urdu (Pakistan)', enabled: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleUILanguage = async (languageCode: string) => {
    setSavingLanguage(languageCode);
    
    try {
      const updatedLanguages = uiLanguages.map(lang => 
        lang.code === languageCode 
          ? { ...lang, enabled: !lang.enabled }
          : lang
      );
      
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/super-admin/languages/ui`,
        { languages: updatedLanguages },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setUiLanguages(updatedLanguages);
      toast.success('UI language settings updated');
    } catch (error) {
      toast.error('Failed to update UI language settings');
    } finally {
      setSavingLanguage(null);
    }
  };

  const toggleSpeechLanguage = async (languageCode: string) => {
    setSavingLanguage(languageCode);
    
    try {
      const updatedLanguages = speechLanguages.map(lang => 
        lang.code === languageCode 
          ? { ...lang, enabled: !lang.enabled }
          : lang
      );
      
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/super-admin/languages/speech`,
        { languages: updatedLanguages },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setSpeechLanguages(updatedLanguages);
      toast.success('Speech language settings updated');
    } catch (error) {
      toast.error('Failed to update speech language settings');
    } finally {
      setSavingLanguage(null);
    }
  };

  const addSpeechLanguage = async (languageCode: string) => {
    const availableLanguage = availableSpeechLanguages.find(lang => lang.code === languageCode);
    if (!availableLanguage) return;

    if (speechLanguages.find(lang => lang.code === languageCode)) {
      toast.error('Language already added');
      return;
    }

    setSavingLanguage(languageCode);
    
    try {
      const newSpeechLanguage = {
        code: languageCode,
        name: availableLanguage.name,
        enabled: true
      };
      
      const updatedLanguages = [...speechLanguages, newSpeechLanguage];
      
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/super-admin/languages/speech`,
        { languages: updatedLanguages },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setSpeechLanguages(updatedLanguages);
      toast.success('Speech language added');
    } catch (error) {
      toast.error('Failed to add speech language');
    } finally {
      setSavingLanguage(null);
    }
  };

  const removeSpeechLanguage = async (languageCode: string) => {
          if (!confirm(t('common.confirmRemoveSpeechLanguage'))) {
      return;
    }

    setSavingLanguage(languageCode);
    
    try {
      const updatedLanguages = speechLanguages.filter(lang => lang.code !== languageCode);
      
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/super-admin/languages/speech`,
        { languages: updatedLanguages },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setSpeechLanguages(updatedLanguages);
      toast.success('Speech language removed');
    } catch (error) {
      toast.error('Failed to remove speech language');
    } finally {
      setSavingLanguage(null);
    }
  };

  const updateDefaultLanguage = async (languageCode: string) => {
    setSavingLanguage('default');
    
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/super-admin/languages/default`,
        { defaultLanguage: languageCode },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setDefaultLanguage(languageCode);
      toast.success('Default language updated');
    } catch (error) {
      toast.error('Failed to update default language');
    } finally {
      setSavingLanguage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          {t('superAdmin.languageSettings')}
        </h1>
        <button
          onClick={fetchLanguageSettings}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Default Language Setting */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {t('superAdmin.defaultLanguage')}
        </h3>
        <div className="flex items-center space-x-4">
          <select
            value={defaultLanguage}
            onChange={(e) => updateDefaultLanguage(e.target.value)}
            disabled={savingLanguage === 'default'}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          >
            {uiLanguages.filter(lang => lang.enabled).map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          {savingLanguage === 'default' && (
            <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
                      {t('common.defaultLanguageDescription')}
        </p>
      </div>

      {/* UI Languages */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {t('superAdmin.supportedLanguages')} (UI)
        </h3>
        <div className="space-y-3">
          {uiLanguages.map((language) => (
            <div key={language.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">{language.name}</div>
                  <div className="text-sm text-gray-600">{language.code}</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleUILanguage(language.code)}
                  disabled={savingLanguage === language.code}
                  className="flex items-center"
                >
                  {savingLanguage === language.code ? (
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
                  ) : language.enabled ? (
                    <ToggleRight className="w-6 h-6 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
                <span className={`text-sm font-medium ${
                  language.enabled ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {language.enabled ? t('superAdmin.enabled') : t('superAdmin.disabled')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Speech Recognition Languages */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {t('superAdmin.speechLanguages')}
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-3 py-1 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors text-sm"
          >
            <Plus size={16} className="mr-1" />
            {t('superAdmin.addLanguage')}
          </button>
        </div>
        
        <div className="space-y-3">
          {speechLanguages.map((language) => (
            <div key={language.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-800">{language.name}</div>
                  <div className="text-sm text-gray-600">{language.code}</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleSpeechLanguage(language.code)}
                  disabled={savingLanguage === language.code}
                  className="flex items-center"
                >
                  {savingLanguage === language.code ? (
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
                  ) : language.enabled ? (
                    <ToggleRight className="w-6 h-6 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
                <span className={`text-sm font-medium ${
                  language.enabled ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {language.enabled ? t('superAdmin.enabled') : t('superAdmin.disabled')}
                </span>
                <button
                  onClick={() => removeSpeechLanguage(language.code)}
                  disabled={savingLanguage === language.code}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Speech Language Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('superAdmin.addLanguage')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {availableSpeechLanguages
                .filter(lang => !speechLanguages.find(existing => existing.code === lang.code))
                .map((language) => (
                  <button
                    key={language.code}
                    onClick={() => {
                      addSpeechLanguage(language.code);
                      setShowAddModal(false);
                    }}
                    disabled={savingLanguage === language.code}
                    className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{language.name}</div>
                        <div className="text-sm text-gray-600">{language.code}</div>
                      </div>
                      {savingLanguage === language.code && (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                      )}
                    </div>
                  </button>
                ))}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSettings; 