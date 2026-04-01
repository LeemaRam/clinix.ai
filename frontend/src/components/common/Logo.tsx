import React from 'react';
import { Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Logo = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center">
      <Headphones size={28} className="text-cyan-600" />
      <div className="ml-2">
        <h1 className="text-lg font-bold text-gray-800">{t('common.clinixAi')}</h1>
        <p className="text-xs text-gray-500">{t('common.audioToMedicalReports')}</p>
      </div>
    </div>
  );
};

export default Logo;