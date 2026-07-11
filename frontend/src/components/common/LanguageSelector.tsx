import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';

const LanguageSelector: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', comingSoon: false },
    { code: 'ur', name: 'Urdu', comingSoon: true }
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    const target = languages.find(lang => lang.code === languageCode);
    if (target?.comingSoon) return;

    i18n.changeLanguage(languageCode);
    setIsOpen(false);

    // Save to localStorage for persistence
    localStorage.setItem('i18nextLng', languageCode);
  };

  const LanguagePill: React.FC<{ code: string }> = ({ code }) => (
    <span className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
      {code}
    </span>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary px-3 py-2 text-sm"
      >
        <Globe size={16} className="text-slate-500" />
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <LanguagePill code={currentLanguage.code} />
          {currentLanguage.name}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="py-2">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  disabled={language.comingSoon}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <div className="flex items-center space-x-3">
                    <LanguagePill code={language.code} />
                    <span>{language.name}</span>
                    {language.comingSoon && (
                      <span className="text-xs text-slate-400">{t('settings.comingSoon')}</span>
                    )}
                  </div>
                  {currentLanguage.code === language.code && !language.comingSoon && (
                    <Check size={16} className="text-primary-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector; 