import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import {
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Mic,
  FileText,
  Activity,
  Edit2,
  Clock,
  Loader2,
  AlertCircle,
  X,
  FileBarChart
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatters';
import { getRecordingTypeLabel } from '../utils/recordingTypes';
import ReportPreviewModal from '../components/ReportPreviewModal';

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
  allergies: string[];
  medical_conditions: string[];
  current_medications: string[];
  consultations: Consultation[];
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: Array<{
    content: string;
    created_at: string;
    updated_at: string;
  }>;
}

interface Consultation {
  id: string;
  type: string;
  doctor_name: string;
  recording_type: string;
  duration?: string;
  audio_duration?: number;
  created_at: string;
  status: string;
}

interface TranscriptionDetail {
  id: string;
  consultation_id: string;
  doctor_id: string;
  raw_text: string;
  confidence_score: number;
  duration: number;
  language: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  started_at: string;
  audio_file_path: string;
  model_used: string;
  processing_time: number;
  segments: Array<{
    text: string;
    speaker: string;
    start: number;
    end: number;
    confidence: number;
    no_speech_prob: number;
    id: number;
  }>;
  analysis: {
    medical_info: {
      symptoms: string[];
      medical_history: string[];
      current_medications: string[];
      diagnosis: string[];
      treatment_plan: string[];
      follow_up: string[];
    };
    summary: string;
  };
}

interface PdfOptions {
  includeSummary: boolean;
  includeMedicalInfo: boolean;
  includeTranscript: boolean;
  includePatientDetails: boolean;
}

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Notes state
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // New state for transcript and report functionality
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>({
    includeSummary: true,
    includeMedicalInfo: true,
    includeTranscript: true,
    includePatientDetails: true
  });

  const { t } = useTranslation();

  // Get auth token from localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Handle API errors
  const handleError = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error: string }>;
      if (axiosError.response?.status === 401) {
        return { message: t('subscription.pleaseLoginToContinue') };
      }
      return { 
        message: axiosError.response?.data?.error || 
                t('subscription.errorOccurredWhileFetchingData')
      };
    }
    return { message: t('subscription.unexpectedErrorOccurred') };
  };

  // Fetch consultation details including transcription
  const fetchConsultationDetail = async (consultationId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/consultations/transcriptions/${consultationId}`,
        {
          headers: getAuthHeaders()
        }
      );

      setTranscription(response.data.transcription);
    } catch (error) {
      const err = handleError(error);
      setDetailError(err.message);
      setTranscription(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle view transcription
  const handleViewTranscription = async (consultationId: string) => {
    setSelectedConsultationId(consultationId);
    setShowTranscriptionModal(true);
    await fetchConsultationDetail(consultationId);
  };

  // Handle report preview
  const handleReportPreview = (consultationId: string) => {
    setSelectedConsultationId(consultationId);
    setShowReportPreviewModal(true);
  };

  // Generate PDF Report with options
  const generatePdfReport = async (consultationId: string) => {
    setPdfGenerating(consultationId);
    try {
      // First, get the full consultation data if not already loaded
      if (!transcription || transcription.consultation_id !== consultationId) {
        await fetchConsultationDetail(consultationId);
      }

      // Prepare the report data based on selected options
      const reportData = {
        consultationId,
        options: pdfOptions,
        consultation: transcription,
        timestamp: new Date().toISOString(),
        generatedBy: localStorage.getItem('user_name') || t('subscription.systemUser')
      };

      const response = await axios({
        url: `${import.meta.env.VITE_API_URL}/api/consultations/${consultationId}/report`,
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        data: reportData,
        responseType: 'blob'
      });

      // Create a blob from the PDF Stream
      const file = new Blob([response.data], { type: 'application/pdf' });
      
      // Create a link element to trigger download
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `consultation-report-${consultationId}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileURL);

              toast.success(t('subscription.pdfReportGeneratedSuccessfully'));
      setShowPdfOptions(false);
    } catch (error) {
      const err = handleError(error);
              toast.error(`${t('subscription.failedToGeneratePdf')}: ${err.message}`);
    } finally {
      setPdfGenerating(null);
    }
  };

  // Transcription Modal Component
  const TranscriptionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">{t('transcription.transcription')}</h3>
          <button
            onClick={() => {
              setShowTranscriptionModal(false);
              setSelectedConsultationId(null);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {detailLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin mr-2" />
              <span>{t('transcription.loadingTranscription')}</span>
            </div>
          ) : transcription ? (
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              {/* Transcription Details Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{t('transcription.confidenceScore')}:</span>
                    <span className="ml-2 font-medium">{(transcription.confidence_score * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('transcription.duration')}:</span>
                    <span className="ml-2 font-medium">{formatDuration(transcription.duration)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('transcription.language')}:</span>
                    <span className="ml-2 font-medium">{transcription.language}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('transcription.status')}:</span>
                    <span className="ml-2 font-medium">{transcription.status}</span>
                  </div>
                </div>
              </div>
              
              {transcription.segments ? (
                <div className="divide-y divide-gray-200">
                  {transcription.segments.map((segment, index) => (
                    <div 
                      key={index} 
                      className={`p-4 ${
                        segment.speaker === 'doctor' ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className={`font-medium ${
                          segment.speaker === 'doctor' ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          {segment.speaker === 'doctor' ? t('patients.doctor') : t('patients.patient')}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">
                            {formatTime(segment.start)} - {formatTime(segment.end)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm">{segment.text}</p>
                    </div>
                  ))}
                </div>
              ) : transcription.raw_text ? (
                <div className="p-4 whitespace-pre-wrap">
                  {transcription.raw_text}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 italic">
                  {t('transcription.noTranscriptionAvailable')}
                </div>
              )}
            </div>
          ) : detailError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-700">
              <AlertCircle className="mr-2" />
              <span>{detailError}</span>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              {t('transcription.noTranscriptionAvailable')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // PDF Options Modal Component
  const PdfOptionsModal = ({ consultationId }: { consultationId: string }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">{t('reports.pdfOptions')}</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={pdfOptions.includePatientDetails}
              onChange={(e) => setPdfOptions(prev => ({
                ...prev,
                includePatientDetails: e.target.checked
              }))}
              className="rounded text-blue-600"
            />
            <span>{t('reports.includePatientDetails')}</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={pdfOptions.includeSummary}
              onChange={(e) => setPdfOptions(prev => ({
                ...prev,
                includeSummary: e.target.checked
              }))}
              className="rounded text-blue-600"
            />
            <span>{t('reports.includeSummary')}</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={pdfOptions.includeMedicalInfo}
              onChange={(e) => setPdfOptions(prev => ({
                ...prev,
                includeMedicalInfo: e.target.checked
              }))}
              className="rounded text-blue-600"
            />
            <span>{t('reports.includeMedicalInfo')}</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={pdfOptions.includeTranscript}
              onChange={(e) => setPdfOptions(prev => ({
                ...prev,
                includeTranscript: e.target.checked
              }))}
              className="rounded text-blue-600"
            />
            <span>{t('reports.includeTranscript')}</span>
          </label>
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={() => setShowPdfOptions(false)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => generatePdfReport(consultationId)}
            disabled={pdfGenerating === consultationId}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {pdfGenerating === consultationId ? (
              <>
                <Loader2 className="animate-spin inline mr-2" size={14} />
                {t('reports.generating')}...
              </>
            ) : (
              t('reports.generatePDF')
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!id) {
          setError(t('common.patientIdMissing'));
          setLoading(false);
          return;
        }

        console.log('Fetching patient with ID:', id); // Debug log
        
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/patients/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        
        console.log('Patient data received:', response.data); // Debug log
        
        if (response.data.patient) {
          // Ensure all array fields exist to prevent undefined errors
          const patientData = {
            ...response.data.patient,
            notes: response.data.patient.notes || [],
            allergies: response.data.patient.allergies || [],
            medical_conditions: response.data.patient.medical_conditions || [],
            current_medications: response.data.patient.current_medications || [],
            consultations: response.data.patient.consultations || []
          };
          setPatient(patientData);
        }
      } catch (err) {
        setError(t('common.failedToFetchPatientDetails'));
        console.error('Error fetching patient:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPatient();
    } else {
              setError(t('common.patientIdMissing'));
      setLoading(false);
    }
  }, [id]);

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

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Add note handling function
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setNotesLoading(true);
    setNotesError(null);
    
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/patients/${id}`,
        { note: newNote },
        { headers: getAuthHeaders() }
      );
      
      // Ensure the response has the proper structure
      if (response.data.patient) {
        // Make sure notes array exists
        const updatedPatient = {
          ...response.data.patient,
          notes: response.data.patient.notes || []
        };
        setPatient(updatedPatient);
      }
      
      setNewNote('');
      setShowAddNote(false);
      toast.success(t('Patient Note Added'));
    } catch (error) {
      setNotesError(t('patients.errorAddingNote'));
      handleError(error);
    } finally {
      setNotesLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">{t('common.loadingPatientDetails')}</div>;
  }

  if (error || !patient) {
    return <div className="p-6 text-center text-red-500">{error || t('common.patientNotFound')}</div>;
  }

  return (
    <div>
      {/* Modals */}
      {showPdfOptions && selectedConsultationId && (
        <PdfOptionsModal consultationId={selectedConsultationId} />
      )}
      {showReportPreviewModal && selectedConsultationId && (
        <ReportPreviewModal
          isOpen={showReportPreviewModal}
          onClose={() => {
            setShowReportPreviewModal(false);
            setSelectedConsultationId(null);
          }}
          consultationId={selectedConsultationId}
          pdfOptions={pdfOptions}
        />
      )}
      {showTranscriptionModal && <TranscriptionModal />}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 lg:mb-6 space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-800">{patient.first_name} {patient.last_name}</h1>
          <p className="text-sm lg:text-base text-gray-600">
            {getAge(patient.date_of_birth)} {t('patients.years')} • {patient.gender} • {t('patients.patientId')}: {id}
          </p>
          {/* Debug info - remove in production */}
          {import.meta.env.DEV && (
            <p className="text-xs text-gray-400 mt-1">
              Debug: URL ID: {id} | Patient ID: {id}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={() => {
              if (id) {
                navigate(`/patients/${id}/edit`);
              } else {
                console.error('Patient ID is undefined');
                setError(t('common.unableToEditPatient'));
              }
            }}
            disabled={!id}
            className="flex items-center justify-center px-4 py-2 text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit2 size={18} className="mr-2" />
            {t('patients.editPatient')}
          </button>
          <Link
            to={`/new-consultation/${id}`}
            className="flex items-center justify-center px-4 py-2 text-white transition-colors rounded-lg bg-cyan-600 hover:bg-cyan-700"
          >
            <Mic size={18} className="mr-2" />
            {t('consultation.newConsultation')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center text-center sm:text-left">
                <div className="flex items-center justify-center w-16 h-16 text-xl font-bold rounded-full bg-cyan-100 text-cyan-600 mx-auto sm:mx-0">
                  {patient.first_name[0]}{patient.last_name[0]}
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-4">
                  <h2 className="text-lg lg:text-xl font-semibold text-gray-800">{patient.first_name} {patient.last_name}</h2>
                  <p className="text-sm lg:text-base text-gray-600">
                    {getAge(patient.date_of_birth)} {t('patients.years')} • {patient.gender}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
              <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">{t('patients.contactInformation')}</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Phone size={18} className="text-gray-400 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-700">{patient.phone}</span>
                </li>
                <li className="flex items-start">
                  <Mail size={18} className="text-gray-400 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-700">{patient.email}</span>
                </li>
                <li className="flex items-start">
                  <MapPin size={18} className="text-gray-400 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-700">{patient.address}</span>
                </li>
                <li className="flex items-start">
                  <Calendar size={18} className="text-gray-400 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-700">{t('patients.born')}: {formatDate(patient.date_of_birth)}</span>
                </li>
              </ul>
            </div>

            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">{t('patients.emergencyContact')}</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <User size={18} className="text-gray-400 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-700">{patient.emergency_contact_name}</span>
                </li>
                <li className="flex items-start">
                  <Phone size={18} className="text-gray-400 mr-2 mt-0.5" />
                  <span className="text-sm text-gray-700">{patient.emergency_contact_phone}</span>
                </li>
              </ul>
            </div>

            <div className="px-6 py-4">
              <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">{t('patients.medicalInformation')}</h3>

              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">{t('patients.bloodType')}</h4>
                <p className="p-2 text-sm text-gray-700 rounded bg-gray-50">{patient.blood_type}</p>
              </div>

              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">{t('patients.allergies')}</h4>
                <div className="flex flex-wrap gap-2">
                  {patient?.allergies?.map((allergy, index) => (
                    <span key={index} className="px-2 py-1 text-xs text-red-700 rounded bg-red-50">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">{t('patients.medicalConditions')}</h4>
                <div className="flex flex-wrap gap-2">
                  {patient?.medical_conditions?.map((condition, index) => (
                    <span key={index} className="px-2 py-1 text-xs text-blue-700 rounded bg-blue-50">
                      {condition}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700">{t('patients.currentMedications')}</h4>
                <ul className="space-y-2">
                  {patient?.current_medications?.map((medication, index) => (
                    <li key={index} className="p-2 text-sm text-gray-700 rounded bg-gray-50">
                      {medication}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-6 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">{t('patients.consultationHistory')}</h2>
              <div className="flex items-center text-sm text-gray-500">
                <Activity size={16} className="mr-1" />
                {patient?.consultations?.length || 0} {t('patients.consultations')}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      {t('patients.date')}
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      {t('patients.type')}
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      {t('consultation.recordingType')}
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      {t('patients.duration')}
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patient?.consultations?.map((consultation) => (
                    <tr key={consultation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(consultation.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{consultation.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            consultation.recording_type === 'doctor_patient' ? 'bg-blue-100 text-blue-800' :
                            consultation.recording_type === 'doctor_only' ? 'bg-green-100 text-green-800' :
                            consultation.recording_type === 'doctor_patient_third' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getRecordingTypeLabel(consultation.recording_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock size={14} className="mr-1" />
                          {formatDuration(consultation.audio_duration)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                        <button
                          onClick={() => handleViewTranscription(consultation.id)}
                          className="mr-3 text-green-600 hover:text-green-900"
                          title={t('transcription.viewTranscription')}
                        >
                          <Mic size={16} className="inline mr-1" />
                          {t('transcription.transcript')}
                        </button>
                        <button
                          onClick={() => handleReportPreview(consultation.id)}
                          className="text-purple-600 hover:text-purple-900"
                          title={t('reports.previewAndEditReport')}
                        >
                          <FileText size={16} className="inline mr-1" />
                          {t('reports.report')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
              {patient?.consultations?.map((consultation) => (
                <div key={consultation.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{formatDate(consultation.created_at)}</div>
                      <div className="text-sm text-gray-600">{consultation.type}</div>
                                              <div className="text-sm text-gray-600">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            consultation.recording_type === 'doctor_patient' ? 'bg-blue-100 text-blue-800' :
                            consultation.recording_type === 'doctor_only' ? 'bg-green-100 text-green-800' :
                            consultation.recording_type === 'doctor_patient_third' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getRecordingTypeLabel(consultation.recording_type)}
                          </span>
                        </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock size={14} className="mr-1" />
                      {formatDuration(consultation.audio_duration)}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleViewTranscription(consultation.id)}
                      className="px-3 py-2 text-sm text-green-600 hover:text-green-900 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                      title={t('transcription.viewTranscription')}
                    >
                      <Mic size={16} className="mr-1 inline" />
                      {t('transcription.transcript')}
                    </button>
                    <button
                      onClick={() => handleReportPreview(consultation.id)}
                      className="px-3 py-2 text-sm text-purple-600 hover:text-purple-900 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                      title={t('reports.previewAndEditReport')}
                    >
                      <FileText size={16} className="mr-1 inline" />
                      {t('reports.report')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:gap-6 md:grid-cols-2">
            <div className="p-4 lg:p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h2 className="mb-3 lg:mb-4 text-base lg:text-lg font-semibold text-gray-800">{t('patients.recentVitals')}</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-500">{t('patients.bloodPressure')}</p>
                    <p className="text-lg font-medium text-gray-800">-</p>
                  </div>
                  <p className="text-xs text-gray-500">-</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-500">{t('patients.heartRate')}</p>
                    <p className="text-lg font-medium text-gray-800">-</p>
                  </div>
                  <p className="text-xs text-gray-500">-</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-500">{t('patients.weight')}</p>
                    <p className="text-lg font-medium text-gray-800">-</p>
                  </div>
                  <p className="text-xs text-gray-500">-</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-500">{t('patients.temperature')}</p>
                    <p className="text-lg font-medium text-gray-800">-</p>
                  </div>
                  <p className="text-xs text-gray-500">-</p>
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h2 className="mb-3 lg:mb-4 text-base lg:text-lg font-semibold text-gray-800">
                {t('patients.notesAndObservations')}
              </h2>
              
              <div className="space-y-4">
                {(!patient?.notes || patient.notes.length === 0) && (
                  <p className="text-gray-500 italic">{t('patients.noNotes')}</p>
                )}
                
                {patient?.notes && patient.notes.map((note, index) => (
                  <div key={index} className={`p-3 border-l-4 ${index % 2 === 0 ? 'border-yellow-400 bg-yellow-50' : 'border-gray-400 bg-gray-50'} rounded-lg`}>
                    <p className="text-sm text-gray-700">{note.content}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {t('patients.addedOn')} {new Date(note.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Add Note Button */}
              {!showAddNote && (
                <button
                  onClick={() => setShowAddNote(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('patients.addNote')}
                </button>
              )}

              {/* Add Note Form */}
              {showAddNote && (
                <div className="mt-4 space-y-4">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    rows={4}
                    placeholder={t('patients.enterNote')}
                  />
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={handleAddNote}
                      disabled={notesLoading || !newNote.trim()}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                    >
                      {notesLoading ? (
                        <>
                          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          {t('common.saving')}
                        </>
                      ) : (
                        t('common.save')
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowAddNote(false);
                        setNewNote('');
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                  
                  {notesError && (
                    <p className="text-sm text-red-600">{notesError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetail;