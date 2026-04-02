import React, { useState, useEffect } from 'react';
import { Search, Plus, UserPlus, Filter, X, Save, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  consultation_count: number;
  status: string;
}

interface PaginatedResponse {
  patients: Patient[];
  total: number;
  page: number;
  pages: number;
}

interface NewPatientData {
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

const Patients = () => {
  const apiRoot = '/api';
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const limit = 10;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New patient form data
  const [newPatient, setNewPatient] = useState<NewPatientData>({
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

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<{ success?: boolean; data?: PaginatedResponse } & PaginatedResponse>(`${apiRoot}/patients`, {
        params: {
          search: searchTerm,
          page: currentPage,
          limit
        },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const payload = response.data?.data || response.data;
      setPatients(payload.patients || []);
      setTotalPages(payload.pages || 1);
      setTotalPatients(payload.total || 0);
    } catch (err) {
      setError(t('errors.somethingWentWrong'));
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [searchTerm, currentPage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewPatient(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayInput = (field: keyof typeof tempArrayInputs) => {
    if (tempArrayInputs[field].trim()) {
      setNewPatient(prev => ({
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
    setNewPatient(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      // Process any remaining text in tempArrayInputs and add to existing arrays
      const processedPatient = {
        ...newPatient,
        medical_conditions: [
          ...newPatient.medical_conditions,
          ...tempArrayInputs.medical_conditions.split(',').map(s => s.trim()).filter(s => s)
        ],
        allergies: [
          ...newPatient.allergies,
          ...tempArrayInputs.allergies.split(',').map(s => s.trim()).filter(s => s)
        ],
        current_medications: [
          ...newPatient.current_medications,
          ...tempArrayInputs.current_medications.split(',').map(s => s.trim()).filter(s => s)
        ]
      };

      console.log('processed data', processedPatient);

      await axios.post(`${apiRoot}/patients`, processedPatient, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      // Reset form and close modal
      setNewPatient({
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
      setTempArrayInputs({
        medical_conditions: '',
        allergies: '',
        current_medications: ''
      });
      setIsModalOpen(false);
      
      // Refresh patients list
      fetchPatients();
    } catch (err) {
      setModalError(t('errors.somethingWentWrong'));
      console.error('Error creating patient:', err);
    } finally {
      setIsSubmitting(false);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs text-green-800 bg-green-100 rounded-full">Active</span>;
      case 'inactive':
        return <span className="px-2 py-1 text-xs text-gray-800 bg-gray-100 rounded-full">Inactive</span>;
      case 'new':
        return <span className="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded-full">New</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{t('patients.patients')}</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors w-full sm:w-auto"
          >
            <Plus size={18} className="mr-2" />
            {t('patients.addPatient')}
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('patients.searchPatients')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-base"
            />
          </div>
          <button
            onClick={fetchPatients}
            className="w-full sm:w-auto px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-base font-medium"
          >
            {t('common.search')}
          </button>
        </div>
      </div>

      {/* Patients Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
            {t('common.loading')}
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
            <div className="text-red-600 mb-2">⚠️</div>
            {error}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <div className="text-gray-400 mb-2">👥</div>
            {t('patients.noPatientsFound')}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.patientName')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.dateOfBirth')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.gender')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.consultations')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {patients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(patient.date_of_birth).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {patient.gender === 'Male' ? t('patients.male') : 
                             patient.gender === 'Female' ? t('patients.female') : 
                             t('patients.other')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {patient.consultation_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="text-cyan-600 hover:text-cyan-900 mr-4 transition-colors"
                          >
                            {t('common.view')}
                          </Link>
                          <Link
                            to={`/patients/${patient.id}/edit`}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            {t('common.edit')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tablet Table View */}
            <div className="hidden md:block lg:hidden bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.patientName')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.dateOfBirth')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.consultations')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {patients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {patient.gender === 'Male' ? t('patients.male') : 
                             patient.gender === 'Female' ? t('patients.female') : 
                             t('patients.other')}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(patient.date_of_birth).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getAge(patient.date_of_birth)} {t('patients.years')}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {patient.consultation_count}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col space-y-1">
                            <Link
                              to={`/patients/${patient.id}`}
                              className="text-cyan-600 hover:text-cyan-900 transition-colors"
                            >
                              {t('common.view')}
                            </Link>
                            <Link
                              to={`/patients/${patient.id}/edit`}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              {t('common.edit')}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {patients.map((patient) => (
                <div key={patient.id} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-lg mb-1">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span>📅</span>
                          <span>{new Date(patient.date_of_birth).toLocaleDateString()}</span>
                          <span className="text-gray-400">•</span>
                          <span>{getAge(patient.date_of_birth)} {t('patients.years')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>👤</span>
                          <span>
                            {patient.gender === 'Male' ? t('patients.male') : 
                             patient.gender === 'Female' ? t('patients.female') : 
                             t('patients.other')}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span>💬 {patient.consultation_count} {t('patients.consultations')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-3 border-t border-gray-100">
                    <Link
                      to={`/patients/${patient.id}`}
                      className="flex-1 px-4 py-2 text-sm text-cyan-600 hover:text-cyan-900 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors text-center font-medium"
                    >
                      {t('common.view')}
                    </Link>
                    <Link
                      to={`/patients/${patient.id}/edit`}
                      className="flex-1 px-4 py-2 text-sm text-blue-600 hover:text-blue-900 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-center font-medium"
                    >
                      {t('common.edit')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-lg shadow border border-gray-200 mt-6">
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  {/* Mobile Pagination */}
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md transition-colors ${
                        currentPage === 1
                          ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <ChevronLeft size={16} className="mr-1" />
                      {t('common.previous')}
                    </button>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md transition-colors ${
                        currentPage === totalPages
                          ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {t('common.next')}
                      <ChevronRight size={16} className="ml-1" />
                    </button>
                  </div>
                  
                  {/* Desktop Pagination */}
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        {t('common.showing')} <span className="font-medium">{Math.min((currentPage - 1) * limit + 1, totalPatients)}</span> {t('common.to')}{' '}
                        <span className="font-medium">{Math.min(currentPage * limit, totalPatients)}</span> {t('common.of')}{' '}
                        <span className="font-medium">{totalPatients}</span> {t('common.results')}
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium transition-colors ${
                            currentPage === 1
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                              : 'text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium transition-colors ${
                            currentPage === totalPages
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                              : 'text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">{t('patients.addPatient')}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.firstName')} *
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={newPatient.first_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.lastName')} *
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={newPatient.last_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.dateOfBirth')} *
                    </label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={newPatient.date_of_birth}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.gender')} *
                    </label>
                    <select
                      name="gender"
                      value={newPatient.gender}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      <option value="Male">{t('patients.male')}</option>
                      <option value="Female">{t('patients.female')}</option>
                      <option value="Other">{t('patients.other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.email')}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={newPatient.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.phone')}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={newPatient.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.address')}
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={newPatient.address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.bloodType')}
                    </label>
                    <select
                      name="blood_type"
                      value={newPatient.blood_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.emergencyContact')}
                    </label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      value={newPatient.emergency_contact_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.emergencyPhone')}
                    </label>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      value={newPatient.emergency_contact_phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Array inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.medicalConditions')} ({t('common.commaSeparated')})
                    </label>
                    <input
                      type="text"
                      value={tempArrayInputs.medical_conditions}
                      onChange={(e) => setTempArrayInputs({...tempArrayInputs, medical_conditions: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder={t('patients.medicalConditionsPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.allergies')} ({t('common.commaSeparated')})
                    </label>
                    <input
                      type="text"
                      value={tempArrayInputs.allergies}
                      onChange={(e) => setTempArrayInputs({...tempArrayInputs, allergies: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder={t('patients.allergiesPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('patients.currentMedications')} ({t('common.commaSeparated')})
                    </label>
                    <input
                      type="text"
                      value={tempArrayInputs.current_medications}
                      onChange={(e) => setTempArrayInputs({...tempArrayInputs, current_medications: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder={t('patients.medicationsPlaceholder')}
                    />
                  </div>
                </div>

                {modalError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    {modalError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Save className="animate-spin mr-2" size={16} />
                        {t('common.saving')}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2" size={16} />
                        {t('common.save')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;