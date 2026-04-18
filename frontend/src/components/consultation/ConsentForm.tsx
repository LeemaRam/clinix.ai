import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConsentFormProps {
  onConsentObtained: (consent: boolean) => void;
}

const ConsentForm: React.FC<ConsentFormProps> = ({ onConsentObtained }) => {
  const { t } = useTranslation();
  const [isConsentObtained, setIsConsentObtained] = useState(false);
  
  const handleConsentToggle = () => {
    const newConsentStatus = !isConsentObtained;
    setIsConsentObtained(newConsentStatus);
    onConsentObtained(newConsentStatus);
  };
  
  return (
    <div>
      <div className="p-4 bg-blue-50 text-blue-700 rounded-lg mb-4 flex items-start">
        <Info size={20} className="mr-2 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">{t('consultation.consentInfo')}</p>
          <p className="text-sm mt-1">
            {t('consultation.consentDescription')}
          </p>
        </div>
      </div>
      
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-4">
          <input 
            id="consentCheckbox" 
            type="checkbox"
            checked={isConsentObtained}
            onChange={handleConsentToggle}
            className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
          />
          <label htmlFor="consentCheckbox" className="ml-2 text-sm font-medium text-gray-700">
            {t('consultation.confirmConsent')}
          </label>
        </div>
        
        {isConsentObtained ? (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center">
            <CheckCircle size={18} className="mr-2" />
            <span>{t('consultation.consentObtained')}</span>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg flex items-center">
            <AlertTriangle size={18} className="mr-2" />
            <span>{t('consultation.obtainConsent')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsentForm;