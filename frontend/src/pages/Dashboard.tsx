import { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { FaUserFriends, FaStethoscope, FaFileAlt } from 'react-icons/fa';
import { FiFileText, FiMic } from 'react-icons/fi';
import { Loader2, Calendar, Clock, AlertCircle, FileTextIcon, CheckCircle, Download, Settings, Edit2, Save, X, Eye, FileDown, Search, FileBarChart } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatters';
import { getRecordingTypeLabel } from '../utils/recordingTypes';

interface DashboardStats {
    total_patients: number;
    total_consultations: number;
    total_reports: number;
    recent_patients: {
        consultation_id: string;
        patient: {
            id: string;
            first_name: string;
            last_name: string;
        };
        consultation_date: string;
        audio_duration?: number;
        recording_type: string;
    }[];
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

const Dashboard = () => {
  const apiRoot = '/api';
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // New state for transcript and report functionality
    const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
    const [transcription, setTranscription] = useState<TranscriptionDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);
    const [showPdfOptions, setShowPdfOptions] = useState(false);
    const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
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
          `${apiRoot}/consultations/transcriptions/${consultationId}`,
          {
            headers: getAuthHeaders()
          }
        );

        const payload = response.data?.data || response.data;
        setTranscription(payload.transcription);
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
          url: `${apiRoot}/consultations/${consultationId}/report`,
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
            <h3 className="text-lg font-semibold">Transcription</h3>
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
        const fetchDashboardStats = async () => {
            try {
                const response = await axios.get(`${apiRoot}/dashboard/stats`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                });
                const payload = response.data?.data || response.data;
                setStats({
                  total_patients: payload.total_patients ?? payload.totalPatients ?? 0,
                  total_consultations: payload.total_consultations ?? payload.totalConsultations ?? 0,
                  total_reports: payload.total_reports ?? payload.totalReports ?? 0,
                  recent_patients: payload.recent_patients ?? []
                });
                setLoading(false);
            } catch (err) {
                setError(t('common.failedToFetchDashboardStatistics'));
                setLoading(false);
            }
        };

        fetchDashboardStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 p-4">
                {error}
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            {/* Modals */}
            {showPdfOptions && selectedConsultationId && (
              <PdfOptionsModal consultationId={selectedConsultationId} />
            )}
            {showTranscriptionModal && <TranscriptionModal />}

            <h1 className="text-xl md:text-2xl font-semibold text-gray-800 mb-4 md:mb-6">
                {t('dashboard.dashboardOverview')}
            </h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="bg-white rounded-lg shadow p-4 md:p-6">
                    <div className="flex items-center">
                        <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                            <FaUserFriends className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                        </div>
                        <div className="ml-3 md:ml-4">
                            <h2 className="text-xs md:text-sm font-medium text-gray-500">{t('dashboard.totalPatients')}</h2>
                            <p className="text-xl md:text-2xl font-semibold text-gray-800">{stats?.total_patients || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 md:p-6">
                    <div className="flex items-center">
                        <div className="p-2 md:p-3 bg-green-100 rounded-full">
                            <FaStethoscope className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                        </div>
                        <div className="ml-3 md:ml-4">
                            <h2 className="text-xs md:text-sm font-medium text-gray-500">{t('dashboard.totalConsultations')}</h2>
                            <p className="text-xl md:text-2xl font-semibold text-gray-800">{stats?.total_consultations || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 md:p-6">
                    <div className="flex items-center">
                        <div className="p-2 md:p-3 bg-purple-100 rounded-full">
                            <FaFileAlt className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                        </div>
                        <div className="ml-3 md:ml-4">
                            <h2 className="text-xs md:text-sm font-medium text-gray-500">{t('dashboard.totalReports')}</h2>
                            <p className="text-xl md:text-2xl font-semibold text-gray-800">{stats?.total_reports || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Patients */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 md:p-6">
                    <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">{t('dashboard.recentPatients')}</h2>
                    
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('dashboard.patientName')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('dashboard.consultationDate')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('consultation.recordingType')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('transcription.duration')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('common.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats?.recent_patients.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {item.patient.first_name} {item.patient.last_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">
                                                {new Date(item.consultation_date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                  item.recording_type === 'doctor_patient' ? 'bg-blue-100 text-blue-800' :
                                                  item.recording_type === 'doctor_only' ? 'bg-green-100 text-green-800' :
                                                  item.recording_type === 'doctor_patient_third' ? 'bg-purple-100 text-purple-800' :
                                                  'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {getRecordingTypeLabel(item.recording_type)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Clock size={14} className="mr-1" />
                                                {formatDuration(item.audio_duration)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleViewTranscription(item.consultation_id)}
                                                className="mr-3 text-green-600 hover:text-green-900 inline-flex items-center"
                                                title={t('transcription.viewTranscription')}
                                            >
                                                <FiMic size={14} className="mr-1" />
                                                {t('transcription.transcript')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedConsultationId(item.consultation_id);
                                                    setShowPdfOptions(true);
                                                }}
                                                disabled={pdfGenerating === item.consultation_id}
                                                className="text-purple-600 hover:text-purple-900 inline-flex items-center disabled:opacity-50"
                                                title={t('reports.generateReport')}
                                            >
                                                {pdfGenerating === item.consultation_id ? (
                                                    <Loader2 className="animate-spin mr-1" size={14} />
                                                ) : (
                                                    <FiFileText size={14} className="mr-1" />
                                                )}
                                                {t('reports.report')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {stats?.recent_patients.map((item, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {item.patient.first_name} {item.patient.last_name}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {new Date(item.consultation_date).toLocaleDateString()}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                              item.recording_type === 'doctor_patient' ? 'bg-blue-100 text-blue-800' :
                                              item.recording_type === 'doctor_only' ? 'bg-green-100 text-green-800' :
                                              item.recording_type === 'doctor_patient_third' ? 'bg-purple-100 text-purple-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                                {getRecordingTypeLabel(item.recording_type)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Clock size={14} className="mr-1" />
                                        {formatDuration(item.audio_duration)}
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <button
                                        onClick={() => handleViewTranscription(item.consultation_id)}
                                        className="px-3 py-2 text-sm text-green-600 hover:text-green-900 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                                        title={t('transcription.viewTranscription')}
                                    >
                                        <FiMic size={14} className="mr-1 inline" />
                                        {t('transcription.transcript')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedConsultationId(item.consultation_id);
                                            setShowPdfOptions(true);
                                        }}
                                        disabled={pdfGenerating === item.consultation_id}
                                        className="px-3 py-2 text-sm text-purple-600 hover:text-purple-900 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                                        title={t('reports.generateReport')}
                                    >
                                        {pdfGenerating === item.consultation_id ? (
                                            <Loader2 className="animate-spin mr-1 inline" size={14} />
                                        ) : (
                                            <FiFileText size={14} className="mr-1 inline" />
                                        )}
                                        {t('reports.report')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard; 