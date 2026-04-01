import React, { useState } from 'react';
import { Users, UserPlus, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RecordingTypeSelectorProps {
  onTypeSelected: (type: string) => void;
}

const RecordingTypeSelector: React.FC<RecordingTypeSelectorProps> = ({ onTypeSelected }) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState('doctor_patient');
  
  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    onTypeSelected(type);
  };
  
  const recordingTypes = [
    {
      id: 'doctor_patient',
      title: t('consultation.doctorPatient'),
      description: t('consultation.doctorPatientDesc'),
      icon: <Users size={24} className="text-cyan-600" />
    },
    {
      id: 'doctor_only',
      title: t('consultation.doctorOnly'),
      description: t('consultation.doctorOnlyDesc'),
      icon: <User size={24} className="text-cyan-600" />
    },
    {
      id: 'doctor_patient_third',
      title: 'Doctor, Patient & Third Party',
      description: 'Records doctor, patient, and an accompanying person',
      icon: <UserPlus size={24} className="text-cyan-600" />
    }
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {recordingTypes.map((type) => (
        <div 
          key={type.id}
          onClick={() => handleTypeChange(type.id)}
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            selectedType === type.id 
              ? 'border-cyan-600 bg-cyan-50 ring-2 ring-cyan-600 ring-opacity-25' 
              : 'border-gray-200 hover:border-cyan-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center mb-2">
            <div className={`p-2 rounded-full ${
              selectedType === type.id ? 'bg-white' : 'bg-gray-100'
            }`}>
              {type.icon}
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-800">{type.title}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-600">{type.description}</p>
        </div>
      ))}
    </div>
  );
};

export default RecordingTypeSelector;