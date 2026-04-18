import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, getAuthHeaders, unwrapApiData } from '../services/apiFetch';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  medical_conditions: string[];
  allergies: string[];
  current_medications: string[];
  status: string;
}

const EditPatient = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  // Form data state
  const [formData, setFormData] = useState<Partial<Patient>>({});

  // Temporary state for array inputs
  const [tempArrayInputs, setTempArrayInputs] = useState({
    medical_conditions: '',
    allergies: '',
    current_medications: ''
  });

  useEffect(() => {
    if (id) {
      fetchPatient();
    }
  }, [id]);

  const fetchPatient = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch<{ patient?: Patient }>({
        path: `/patients/${id}`,
        method: 'GET',
        headers: getAuthHeaders()
      });

      const payload = unwrapApiData<{ patient?: Patient }>(response.data as any);
      if (payload.patient) {
        setPatient(payload.patient);
        setFormData(payload.patient);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.somethingWentWrong'));
      console.error('Error fetching patient:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayInput = (field: keyof typeof tempArrayInputs) => {
    if (tempArrayInputs[field].trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...(prev[field] || []), tempArrayInputs[field].trim()]
      }));
      setTempArrayInputs(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const removeArrayItem = (field: keyof typeof tempArrayInputs, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      // Process array inputs
      const processedData = {
        ...formData,
        medical_conditions: tempArrayInputs.medical_conditions.split(',').map(s => s.trim()).filter(s => s),
        allergies: tempArrayInputs.allergies.split(',').map(s => s.trim()).filter(s => s),
        current_medications: tempArrayInputs.current_medications.split(',').map(s => s.trim()).filter(s => s)
      };

      await apiFetch({
        path: `/patients/${id}`,
        method: 'PUT',
        data: processedData,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      // Reset temp inputs
      setTempArrayInputs({
        medical_conditions: '',
        allergies: '',
        current_medications: ''
      });

      navigate(`/patients/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || t('errors.somethingWentWrong'));
      console.error('Error updating patient:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{t('errors.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link
            to={`/patients/${id}`}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={20} className="mr-2" />
            {t('common.back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{t('patients.editPatient')}</h1>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('patients.basicInformation')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.firstName')} *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.lastName')} *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.dateOfBirth')} *
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.gender')} *
                </label>
                <select
                  name="gender"
                  value={formData.gender || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">{t('common.select')}</option>
                  <option value="male">{t('patients.male')}</option>
                  <option value="female">{t('patients.female')}</option>
                  <option value="other">{t('patients.other')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('patients.contactInformation')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.phone')}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.address')}
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('patients.bloodType')}
                </label>
                <select
                  name="blood_type"
                  value={formData.blood_type || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">{t('common.select')}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('patients.emergencyContact')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('patients.emergencyContact')}
              </label>
              <input
                type="text"
                name="emergency_contact_name"
                value={formData.emergency_contact_name || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('patients.emergencyPhone')}
              </label>
              <input
                type="tel"
                name="emergency_contact_phone"
                value={formData.emergency_contact_phone || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Medical Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('patients.medicalInformation')}</h2>
          <div className="space-y-4">
            {/* Medical Conditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('patients.medicalConditions')}
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={tempArrayInputs.medical_conditions}
                  onChange={(e) => setTempArrayInputs(prev => ({ ...prev, medical_conditions: e.target.value }))}
                  placeholder={t('patients.medicalConditionsPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('medical_conditions')}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  {t('common.add')}
                </button>
              </div>
              {formData.medical_conditions && formData.medical_conditions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.medical_conditions.map((condition, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {condition}
                      <button
                        type="button"
                        onClick={() => removeArrayItem('medical_conditions', index)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('patients.allergies')}
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={tempArrayInputs.allergies}
                  onChange={(e) => setTempArrayInputs(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder={t('patients.allergiesPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('allergies')}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  {t('common.add')}
                </button>
              </div>
              {formData.allergies && formData.allergies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.allergies.map((allergy, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                      {allergy}
                      <button
                        type="button"
                        onClick={() => removeArrayItem('allergies', index)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Current Medications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('patients.currentMedications')}
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={tempArrayInputs.current_medications}
                  onChange={(e) => setTempArrayInputs(prev => ({ ...prev, current_medications: e.target.value }))}
                  placeholder={t('patients.medicationsPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('current_medications')}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  {t('common.add')}
                </button>
              </div>
              {formData.current_medications && formData.current_medications.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.current_medications.map((medication, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {medication}
                      <button
                        type="button"
                        onClick={() => removeArrayItem('current_medications', index)}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <Link
            to={`/patients/${id}`}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPatient;
