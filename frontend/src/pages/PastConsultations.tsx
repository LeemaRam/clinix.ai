import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { Loader2, Calendar, Clock, AlertCircle, Trash2, FileText, CheckCircle, Download, Settings, Edit2, Save, X, Eye, FileDown, Search, FileBarChart } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { formatDuration, formatTime } from '../utils/formatters';
import { getRecordingTypeLabel } from '../utils/recordingTypes';
import ReportPreviewModal from '../components/ReportPreviewModal';
import { getSocket, joinConsultationRoom } from '../services/socket';
import RealtimeStatusBadge from '../components/common/RealtimeStatusBadge';

interface ConsultationBasic {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: 'recorded' | 'pending' | 'in_progress';
  consultation_type: string;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
  recording_type: string;
  audio_file_path?: string;
  audio_file_size?: number;
  audio_format?: string;
  consent_obtained: boolean;
  consent_timestamp: string;
  notes?: string;
  metadata: Record<string, any>;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    date_of_birth: string;
    gender: string;
  };
  doctor?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface TransformedConsultation extends Omit<ConsultationBasic, 'status'> {
  patientName: string;
  doctorName: string;
  date: string;
  status: 'completed' | 'pending';
  audio_duration?: number;
}

interface ConsultationDetail extends TransformedConsultation {
  transcriptionText: string | null;
  patientDetails?: {
    id: string;
    age: number;
    gender: string;
  };
  confidence?: number;
  segments?: Array<{
    text: string;
    speaker: string;
    start_time: number;
    end_time: number;
    confidence: number;
    no_speech_prob?: number;
    id?: number;
  }>;
  medical_info?: {
    symptoms: string[];
    medical_history: string[];
    current_medications: string[];
    diagnosis: string[];
    treatment_plan: string[];
    follow_up: string[];
  };
  consultation_summary?: string;
}

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
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

interface TranscriptionProgressEvent {
  consultationId: string;
  progress: number;
  status: 'processing' | 'finalizing' | 'completed' | 'failed';
}

interface ReportGenerationEvent {
  consultationId: string;
  previewId?: string | null;
  reportId?: string;
}

const PastConsultations: React.FC = () => {
  const apiRoot = '/api';
  const { t } = useTranslation();
  const [consultations, setConsultations] = useState<TransformedConsultation[]>([]);
  const [filteredConsultations, setFilteredConsultations] = useState<TransformedConsultation[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>({
    includeSummary: true,
    includeMedicalInfo: true,
    includeTranscript: true,
    includePatientDetails: true
  });
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionDetail | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
    hasMore: false
  });
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const [savingSegment, setSavingSegment] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [transcriptionProgressByConsultation, setTranscriptionProgressByConsultation] = useState<Record<string, number>>({});
  const [reportGenerationInProgress, setReportGenerationInProgress] = useState<Record<string, boolean>>({});

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
        // Handle unauthorized - could redirect to login
        return { message: t('subscription.pleaseLoginToContinue') };
      }
      if (!axiosError.response) {
        return { message: t('errors.networkError') };
      }
      return { 
        message: axiosError.response?.data?.error || 
                t('errors.somethingWentWrong')
      };
    }
    return { message: t('errors.somethingWentWrong') };
  };

  // Fetch consultation list
  const fetchConsultationList = async (page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${apiRoot}/consultations`,
        {
          params: { page, limit: 10 },
          headers: getAuthHeaders()
        }
      );
      const payload = response.data?.data || response.data;

      // Transform the API response to match our component's needs
      const transformedConsultations = (payload.consultations || []).map((consultation: ConsultationBasic) => {
        let transformedStatus: 'completed' | 'pending';
        // Improved status mapping logic
        if (consultation.status === 'recorded' || consultation.status === 'in_progress') {
          transformedStatus = 'completed';
        } else {
          transformedStatus = 'pending';
        }

        const patientName = consultation.patient 
          ? `${consultation.patient.first_name} ${consultation.patient.last_name}`
          : `Patient ${consultation.patient_id}`;

        const doctorName = consultation.doctor?.full_name || `Doctor ${consultation.doctor_id}`;

        return {
          ...consultation,
          patientName,
          doctorName,
          date: consultation.scheduled_at,
          status: transformedStatus
        };
      });

      setConsultations(transformedConsultations);
      setFilteredConsultations(transformedConsultations);
      setPagination({
        total: payload.pagination?.total || 0,
        page: payload.pagination?.page || 1,
        totalPages: payload.pagination?.pages || 1,
        hasMore: (payload.pagination?.page || 1) < (payload.pagination?.pages || 1)
      });
    } catch (error) {
      const err = handleError(error);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete consultation
  const deleteConsultation = async (consultationId: string) => {
    if (!window.confirm(t('consultation.confirmDelete'))) {
      return;
    }

    setDeleteLoading(consultationId);
    try {
      await axios.delete(
        `${apiRoot}/consultations/${consultationId}`,
        { headers: getAuthHeaders() }
      );

      // Remove from list and clear selection if needed
      setConsultations(prev => prev.filter(c => c.id !== consultationId));
      setFilteredConsultations(prev => prev.filter(c => c.id !== consultationId));
      if (selectedConsultation?.id === consultationId) {
        setSelectedConsultation(null);
      }

      toast.success(t('consultation.consultationDeleted'));
    } catch (error) {
      const err = handleError(error);
      toast.error(err.message);
    } finally {
      setDeleteLoading(null);
    }
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

  // Handle consultation selection
  const handleConsultationSelect = (consultation: TransformedConsultation) => {
    if (selectedConsultation?.id === consultation.id) {
      setSelectedConsultation(null);
    } else {
      fetchConsultationDetail(consultation.id);
    }
  };

  // Handle view consultation details
  const handleViewConsultation = async (consultation: TransformedConsultation) => {
    joinConsultationRoom(consultation.id);
    setSelectedConsultation(consultation as ConsultationDetail);
    setShowDetailModal(true);
    await fetchConsultationDetail(consultation.id);
  };

  // Handle view transcription
  const handleViewTranscription = async (consultation: TransformedConsultation) => {
    joinConsultationRoom(consultation.id);
    setSelectedConsultation(consultation as ConsultationDetail);
    setShowTranscriptionModal(true);
    await fetchConsultationDetail(consultation.id);
  };

  // Handle report preview
  const handleReportPreview = (consultation: TransformedConsultation) => {
    joinConsultationRoom(consultation.id);
    setSelectedConsultation(consultation as ConsultationDetail);
    setShowReportPreviewModal(true);
  };

  // Generate PDF Report with options (legacy method - kept for backward compatibility)
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

      toast.success(t('reports.reportGenerated'));
      setShowPdfOptions(false);
    } catch (error) {
      const err = handleError(error);
      toast.error(`${t('reports.reportFailed')}: ${err.message}`);
    } finally {
      setPdfGenerating(null);
    }
  };

  // Detailed View Modal Component
  const DetailModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">{t('consultation.consultationDetails')}</h3>
          <button
            onClick={() => {
              setShowDetailModal(false);
              setSelectedConsultation(null);
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
              <span>{t('consultation.loadingConsultationDetails')}</span>
            </div>
          ) : transcription ? (
            <div>
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('patients.patient')}:</span>
                    <span className="ml-2">{selectedConsultation?.patientName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('patients.doctor')}:</span>
                    <span className="ml-2">Dr. {selectedConsultation?.doctorName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('consultation.type')}:</span>
                    <span className="ml-2">{selectedConsultation?.consultation_type}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('patients.date')}:</span>
                    <span className="ml-2">{formatDate(transcription.created_at)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('transcription.duration')}:</span>
                    <span className="ml-2">{formatDuration(transcription.duration)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('transcription.status')}:</span>
                    <span className={`ml-2 ${transcription.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {transcription.status === 'completed' ? t('transcription.completed') : t('transcription.processing')}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{t('transcription.language')}:</span>
                    <span className="ml-2">{transcription.language}</span>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              {transcription.analysis?.summary && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                    <FileText size={16} className="mr-2" />
                    {t('transcription.consultationSummary')}
                  </h4>
                  <p className="text-sm text-blue-900">{transcription.analysis.summary}</p>
                </div>
              )}

              {/* Medical Information */}
              {transcription.analysis?.medical_info && (
                <div className="mb-6 grid grid-cols-2 gap-4">
                  {Object.entries(transcription.analysis.medical_info).map(([key, items]) => (
                    items && items.length > 0 && (
                      <div key={key} className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">
                          {t(`transcription.${key}`)}
                        </h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {items.map((item, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-gray-400 mr-2">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  ))}
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
              {t('consultation.noConsultationDetailsAvailable')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Transcription Modal Component
  const TranscriptionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">{t('transcription.transcription')}</h3>
          <button
            onClick={() => {
              setShowTranscriptionModal(false);
              setSelectedConsultation(null);
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
                          {editingSegmentId !== segment.id && (
                            <button
                              onClick={() => handleEditStart(segment)}
                              className="p-1 text-gray-400 hover:text-blue-500 rounded"
                              title={t('transcription.editSegment')}
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {editingSegmentId === segment.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={handleEditCancel}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 flex items-center"
                              disabled={savingSegment}
                            >
                              <X size={14} className="mr-1" />
                              {t('common.cancel')}
                            </button>
                            <button
                              onClick={() => handleEditSave(segment)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
                              disabled={savingSegment}
                            >
                              {savingSegment ? (
                                <>
                                  <Loader2 className="animate-spin mr-1" size={14} />
                                  {t('common.saving')}
                                </>
                              ) : (
                                <>
                                  <Save size={14} className="mr-1" />
                                  {t('common.save')}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm">{segment.text}</p>
                      )}
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
                {t('reports.generating')}
              </>
            ) : (
              t('reports.generatePDF')
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Handle segment edit start
  const handleEditStart = (segment: TranscriptionDetail['segments'][0]) => {
    console.log(segment);
    setEditingSegmentId(segment.id);
    setEditedText(segment.text);
  };

  // Handle segment edit cancel
  const handleEditCancel = () => {
    setEditingSegmentId(null);
    setEditedText('');
  };

  // Handle segment edit save
  const handleEditSave = async (segment: TranscriptionDetail['segments'][0]) => {
    if (!transcription) return;
    
    setSavingSegment(true);
    try {
      const response = await axios.patch(
        `${apiRoot}/consultations/transcriptions/${transcription.consultation_id}/segments/${segment.id}`,
        {
          text: editedText,
        },
        { headers: getAuthHeaders() }
      );

      // Update the transcription state with the edited segment
      setTranscription(prev => {
        if (!prev) return null;
        return {
          ...prev,
          segments: prev.segments.map(s => 
            s.id === segment.id ? { ...s, text: editedText } : s
          )
        };
      });

      setEditingSegmentId(null);
      setEditedText('');
      toast.success(t('transcription.segmentUpdated'));
    } catch (error) {
      const err = handleError(error);
      toast.error(`${t('transcription.updateFailed')}: ${err.message}`);
    } finally {
      setSavingSegment(false);
    }
  };

  useEffect(() => {
    fetchConsultationList();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onTranscriptionProgress = (event: TranscriptionProgressEvent) => {
      setTranscriptionProgressByConsultation((prev) => ({
        ...prev,
        [event.consultationId]: event.progress
      }));

      if (event.status === 'completed') {
        setConsultations((prev) => prev.map((item) => (
          item.id === event.consultationId ? { ...item, status: 'completed' } : item
        )));
        setFilteredConsultations((prev) => prev.map((item) => (
          item.id === event.consultationId ? { ...item, status: 'completed' } : item
        )));
      }

      setTranscription((prev) => {
        if (!prev || prev.consultation_id !== event.consultationId) return prev;
        return { ...prev, status: event.status === 'completed' ? 'completed' : 'processing' };
      });
    };

    const onReportGenerationStarted = (event: ReportGenerationEvent) => {
      setReportGenerationInProgress((prev) => ({ ...prev, [event.consultationId]: true }));
    };

    const onReportGenerationCompleted = (event: ReportGenerationEvent) => {
      setReportGenerationInProgress((prev) => ({ ...prev, [event.consultationId]: false }));
    };

    socket.on('transcription_progress', onTranscriptionProgress);
    socket.on('report_generation_started', onReportGenerationStarted);
    socket.on('report_generation_completed', onReportGenerationCompleted);

    return () => {
      socket.off('transcription_progress', onTranscriptionProgress);
      socket.off('report_generation_started', onReportGenerationStarted);
      socket.off('report_generation_completed', onReportGenerationCompleted);
    };
  }, []);

  // Filter consultations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConsultations(consultations);
    } else {
      const filtered = consultations.filter(consultation =>
        consultation.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        consultation.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        consultation.consultation_type.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConsultations(filtered);
    }
  }, [searchQuery, consultations]);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };





  return (
    <div className="container mx-auto px-3 md:px-4">
      {showPdfOptions && selectedConsultation && (
        <PdfOptionsModal consultationId={selectedConsultation.id} />
      )}

      {showReportPreviewModal && selectedConsultation && (
        <ReportPreviewModal
          isOpen={showReportPreviewModal}
          onClose={() => {
            setShowReportPreviewModal(false);
            setSelectedConsultation(null);
          }}
          consultationId={selectedConsultation.id}
          pdfOptions={pdfOptions}
        />
      )}

      {showDetailModal && <DetailModal />}
      {showTranscriptionModal && <TranscriptionModal />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 space-y-4 md:space-y-0">
        <h1 className="text-xl md:text-2xl font-bold">{t('navigation.pastConsultations')}</h1>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={t('consultation.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {selectedConsultation && transcriptionProgressByConsultation[selectedConsultation.id] !== undefined && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <RealtimeStatusBadge
            label={`${t('transcription.processing')}: ${transcriptionProgressByConsultation[selectedConsultation.id]}%`}
            tone="info"
          />
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin mr-2" />
          <span>{t('consultation.loadingConsultations')}</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-700">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredConsultations.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              {searchQuery ? t('consultation.noConsultationsFoundMatchingSearch') : t('consultation.noConsultationsFound')}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.patient')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('consultation.type')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('consultation.recordingType')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('patients.date')}
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
                    {filteredConsultations.map((consultation) => (
                      <tr key={consultation.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {consultation.patientName}
                          </div>
                        </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {consultation.consultation_type}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
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
                          <div className="text-sm text-gray-900 flex items-center">
                            <Calendar size={14} className="mr-2 text-gray-400" />
                            {formatDate(consultation.date)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center">
                            <Clock size={14} className="mr-2 text-gray-400" />
                            {formatDuration(consultation.audio_duration)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {(transcriptionProgressByConsultation[consultation.id] ?? 0) > 0 && (transcriptionProgressByConsultation[consultation.id] ?? 0) < 100 && (
                            <div className="mb-1">
                              <RealtimeStatusBadge
                                label={`${t('transcription.processing')}: ${transcriptionProgressByConsultation[consultation.id]}%`}
                                tone="info"
                              />
                            </div>
                          )}
                          {reportGenerationInProgress[consultation.id] && (
                            <div className="mb-1">
                              <RealtimeStatusBadge label={t('reports.generating')} tone="warning" />
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewConsultation(consultation)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"
                              title={t('consultation.viewDetails')}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleViewTranscription(consultation)}
                              className="text-green-600 hover:text-green-900 p-1 rounded transition-colors"
                              title={t('transcription.viewTranscription')}
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              onClick={() => handleReportPreview(consultation)}
                              className="text-purple-600 hover:text-purple-900 p-1 rounded transition-colors"
                              title={t('reports.previewAndEditReport')}
                            >
                              <FileBarChart size={16} />
                            </button>
                            <button
                              onClick={() => deleteConsultation(consultation.id)}
                              disabled={deleteLoading === consultation.id}
                              className="text-red-600 hover:text-red-900 p-1 rounded transition-colors disabled:opacity-50"
                              title={t('common.delete')}
                            >
                              {deleteLoading === consultation.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {filteredConsultations.map((consultation) => (
                  <div key={consultation.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">{consultation.patientName}</div>
                        <div className="text-sm text-gray-600">{consultation.consultation_type}</div>
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        consultation.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {consultation.status === 'completed' ? t('transcription.completed') : t('transcription.pending')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <Calendar size={14} className="mr-1" />
                        {formatDate(consultation.date)}
                      </div>
                      <div className="flex items-center">
                        <Clock size={14} className="mr-1" />
                        {formatDuration(consultation.audio_duration)}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleViewConsultation(consultation)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded transition-colors"
                        title={t('consultation.viewDetails')}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleViewTranscription(consultation)}
                        className="text-green-600 hover:text-green-900 p-2 rounded transition-colors"
                        title={t('transcription.viewTranscription')}
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        onClick={() => handleReportPreview(consultation)}
                        className="text-purple-600 hover:text-purple-900 p-2 rounded transition-colors"
                        title={t('reports.previewAndEditReport')}
                      >
                        <FileBarChart size={16} />
                      </button>
                      <button
                        onClick={() => deleteConsultation(consultation.id)}
                        disabled={deleteLoading === consultation.id}
                        className="text-red-600 hover:text-red-900 p-2 rounded transition-colors disabled:opacity-50"
                        title={t('common.delete')}
                      >
                        {deleteLoading === consultation.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => fetchConsultationList(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md transition-colors ${
                        pagination.page === 1
                          ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {t('common.previous')}
                    </button>
                    <button
                      onClick={() => fetchConsultationList(pagination.page + 1)}
                      disabled={!pagination.hasMore}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md transition-colors ${
                        !pagination.hasMore
                          ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {t('common.next')}
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        {t('common.showing')} <span className="font-medium">{Math.min((pagination.page - 1) * 10 + 1, pagination.total)}</span> {t('common.to')}{' '}
                        <span className="font-medium">{Math.min(pagination.page * 10, pagination.total)}</span> {t('common.of')}{' '}
                        <span className="font-medium">{pagination.total}</span> {t('common.results')}
                        {searchQuery && <span className="text-gray-500"> ({t('common.filtered')})</span>}
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => fetchConsultationList(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium transition-colors ${
                            pagination.page === 1
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                              : 'text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {t('common.previous')}
                        </button>
                        <button
                          onClick={() => fetchConsultationList(pagination.page + 1)}
                          disabled={!pagination.hasMore}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium transition-colors ${
                            !pagination.hasMore
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                              : 'text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {t('common.next')}
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PastConsultations; 