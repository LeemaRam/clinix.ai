import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, X, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, getAuthHeaders, unwrapApiData } from '../services/apiFetch';

interface Patient {
  _id: string;
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
}

interface PatientEditData {
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
}

const PatientEdit = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const [patientData, setPatientData] = useState<PatientEditData>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    blood_type: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_conditions: [],
    allergies: [],
    current_medications: []
  });

  // Temporary state for array inputs
  const [tempArrayInputs, setTempArrayInputs] = useState({
    medical_conditions: '',
    allergies: '',
    current_medications: ''
  });

  useEffect(() => {
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
        const patient = payload.patient;
        if (!patient) {
          throw new Error('Patient not found');
        }
        // converting date_of_birth to YYYY-MM-DD format for input[type="date"]
        const formattedDateOfBirth = new Date(patient.date_of_birth).toISOString().split('T')[0];
        setPatientData({
          first_name: patient.first_name,
          last_name: patient.last_name,
          date_of_birth: formattedDateOfBirth,
          gender: patient.gender,
          email: patient.email,
          phone: patient.phone,
          address: patient.address,
          blood_type: patient.blood_type,
          emergency_contact_name: patient.emergency_contact_name,
          emergency_contact_phone: patient.emergency_contact_phone,
          medical_conditions: patient.medical_conditions || [],
          allergies: patient.allergies || [],
          current_medications: patient.current_medications || []
        });
      } catch (err) {
        setError(t('common.failedToFetchPatientDetails'));
        console.error('Error fetching patient:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPatient();
    }
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPatientData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayInput = (field: keyof typeof tempArrayInputs) => {
    if (tempArrayInputs[field].trim()) {
      setPatientData(prev => ({
        ...prev,
        [field]: [...prev[field], tempArrayInputs[field].trim()]
      }));
      setTempArrayInputs(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const removeArrayItem = (field: keyof typeof tempArrayInputs, index: number) => {
    setPatientData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      await apiFetch({
        path: `/patients/${id}`,
        method: 'PUT',
        data: patientData,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      // Navigate back to patient detail page
      navigate(`/patients/${id}`);
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to update patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading patient details...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate(`/patients/${id}`)}
            className="flex items-center mr-4 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Edit Patient</h1>
            <p className="text-gray-600">Update patient information</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {submitError && (
          <div className="p-4 text-red-700 border-b border-red-100 bg-red-50">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    required
                    value={patientData.first_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    value={patientData.last_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    required
                    value={patientData.date_of_birth}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Gender *
                  </label>
                  <select
                    name="gender"
                    required
                    value={patientData.gender}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={patientData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={patientData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Address
                </label>
                <textarea
                  name="address"
                  value={patientData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Medical Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Medical Information</h3>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Blood Type
                </label>
                <select
                  name="blood_type"
                  value={patientData.blood_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 md:w-48"
                >
                  <option value="">Select blood type</option>
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

            {/* Emergency Contact */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Emergency Contact</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={patientData.emergency_contact_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="emergency_contact_phone"
                    value={patientData.emergency_contact_phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Medical Conditions */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Medical Conditions</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {patientData.medical_conditions.map((condition, index) => (
                  <span key={index} className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempArrayInputs.medical_conditions}
                  onChange={(e) => setTempArrayInputs(prev => ({ ...prev, medical_conditions: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('medical_conditions'))}
                  placeholder="Add medical condition"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('medical_conditions')}
                  className="px-4 py-2 text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Allergies */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Allergies</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {patientData.allergies.map((allergy, index) => (
                  <span key={index} className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-800 rounded-full">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempArrayInputs.allergies}
                  onChange={(e) => setTempArrayInputs(prev => ({ ...prev, allergies: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('allergies'))}
                  placeholder="Add allergy"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('allergies')}
                  className="px-4 py-2 text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Current Medications */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Current Medications</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {patientData.current_medications.map((medication, index) => (
                  <span key={index} className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempArrayInputs.current_medications}
                  onChange={(e) => setTempArrayInputs(prev => ({ ...prev, current_medications: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleArrayInput('current_medications'))}
                  placeholder="Add medication"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleArrayInput('current_medications')}
                  className="px-4 py-2 text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(`/patients/${id}`)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center px-4 py-2 text-white transition-colors rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
            >
              <Save size={18} className="mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientEdit; 