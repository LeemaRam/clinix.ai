import React, { useState } from 'react';
import { Search, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Patient {
  id: number;
  name: string;
  dob: string;
  gender: string;
  lastVisit: string;
}

interface PatientSelectProps {
  onPatientSelected: (patient: Patient | null) => void;
}

const PatientSelect: React.FC<PatientSelectProps> = ({ onPatientSelected }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Mock patient data
  const patients: Patient[] = [
    { id: 1, name: 'Maria Garcia', dob: '1985-06-12', gender: 'Female', lastVisit: '2025-03-15' },
    { id: 2, name: 'Juan Rodriguez', dob: '1978-09-23', gender: 'Male', lastVisit: '2025-04-02' },
    { id: 3, name: 'Ana Martinez', dob: '1992-12-05', gender: 'Female', lastVisit: '2025-03-28' },
    { id: 4, name: 'Carlos Sanchez', dob: '1965-03-18', gender: 'Male', lastVisit: '2025-04-05' },
    { id: 5, name: 'Elena Fernandez', dob: '2000-01-30', gender: 'Female', lastVisit: '2025-04-08' },
  ];
  
  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    onPatientSelected(patient);
    setSearchTerm('');
  };
  
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  const getAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };
  
  return (
    <div>
      {selectedPatient ? (
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 font-medium">
              {selectedPatient.name.substring(0, 2)}
            </div>
            <div className="ml-4">
              <p className="text-lg font-medium text-gray-800">{selectedPatient.name}</p>
              <p className="text-sm text-gray-500">
                {getAge(selectedPatient.dob)} {t('patients.years')} • {selectedPatient.gender} • {t('patients.lastVisit')}: {formatDate(selectedPatient.lastVisit)}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedPatient(null);
              onPatientSelected(null);
            }}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            {t('common.change')}
          </button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <input
              type="text"
              placeholder={t('patients.searchForPatient')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-4 text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white border border-gray-200"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          </div>
          
          {searchTerm && (
            <div className="mt-2 bg-white rounded-md shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
              {filteredPatients.length > 0 ? (
                filteredPatients.map(patient => (
                  <div 
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient)}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 font-medium">
                      {patient.name.substring(0, 2)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-800">{patient.name}</p>
                      <p className="text-xs text-gray-500">
                        {getAge(patient.dob)} {t('patients.years')} • {patient.gender} • {t('patients.lastVisit')}: {formatDate(patient.lastVisit)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  {t('patients.noPatientsFoundTryDifferentSearch')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientSelect;