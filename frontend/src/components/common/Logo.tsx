import React from 'react';
import { Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type LogoProps = {
  theme?: 'light' | 'dark';
  compact?: boolean;
};

const Logo: React.FC<LogoProps> = ({ theme = 'light', compact = false }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isDark ? 'bg-white/10 text-white' : 'bg-primary-600 text-white'} shadow-soft`}>
        <Stethoscope size={20} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <h1 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('common.clinixAi')}</h1>
          <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('common.audioToMedicalReports')}</p>
        </div>
      )}
    </div>
  );
};

export default Logo;