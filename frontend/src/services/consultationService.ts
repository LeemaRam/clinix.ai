import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export interface Consultation {
  _id: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth?: string;
  };
  doctorId: string;
  consultationType: string;
  recordingType: string;
  consentObtained: boolean;
  consentTimestamp?: string;
  status: 'scheduled' | 'recorded' | 'transcribed' | 'completed' | 'failed';
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  languageDetected?: string;
  consultationSummary?: string;
  medicalInfo?: {
    medications_mentioned: string[];
    follow_up_days: number;
    soap: any;
  };
  soapApprovalStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Transcription {
  _id: string;
  consultationId: string;
  doctorId: string;
  audioFilePath?: string;
  status: 'processing' | 'completed' | 'failed';
  rawText?: string;
  segments?: any[];
  confidenceScore?: number;
  duration?: number;
  language?: string;
  modelUsed?: string;
  analysis?: any;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationWithTranscription extends Consultation {
  transcription?: Transcription;
}

export interface ConsultationListResponse {
  consultations: ConsultationWithTranscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// List consultations with pagination
export const listConsultations = async (params?: {
  page?: number;
  limit?: number;
}): Promise<ConsultationListResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const res = await apiFetch({
    path: `/consultations${query}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

// Create a new consultation
export const createConsultation = async (data: {
  patient_id: string;
  consultation_type?: string;
  recording_type?: string;
  consent_obtained?: boolean;
}): Promise<Consultation> => {
  const res = await apiFetch({
    path: '/consultations',
    method: 'POST',
    headers: getAuthHeaders(),
    data
  });
  return unwrapApiData(res).consultation;
};

// Delete a consultation
export const deleteConsultation = async (consultationId: string): Promise<void> => {
  await apiFetch({
    path: `/consultations/${consultationId}`,
    method: 'DELETE',
    headers: getAuthHeaders()
  });
};

// Upload audio for a consultation
export const uploadAudio = async (
  consultationId: string,
  audioFile: File,
  speechLanguage?: string
): Promise<{ consultation: Consultation; transcription: Transcription }> => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  if (speechLanguage) {
    formData.append('speech_language', speechLanguage);
  }

  const res = await apiFetch({
    path: `/consultations/${consultationId}/upload-audio`,
    method: 'POST',
    headers: getAuthHeaders(),
    data: formData
  });
  return unwrapApiData(res);
};

// Get transcription for a consultation
export const getTranscriptionByConsultation = async (
  consultationId: string
): Promise<Transcription> => {
  const res = await apiFetch({
    path: `/consultations/transcriptions/${consultationId}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res).transcription;
};

// Update transcription segment
export const patchTranscriptionSegment = async (
  consultationId: string,
  segmentId: string,
  updates: any
): Promise<Transcription> => {
  const res = await apiFetch({
    path: `/consultations/transcriptions/${consultationId}/segments/${segmentId}`,
    method: 'PATCH',
    headers: getAuthHeaders(),
    data: updates
  });
  return unwrapApiData(res).transcription;
};

// Generate consultation report PDF
export const generateConsultationReportPdf = async (
  consultationId: string
): Promise<Blob> => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/report`,
    method: 'POST',
    headers: getAuthHeaders(),
    responseType: 'blob'
  });
  return res.data;
};

// Generate report preview
export const generateReportPreview = async (
  consultationId: string
): Promise<any> => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/report/preview`,
    method: 'POST',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

// Update report preview
export const updateReportPreview = async (
  consultationId: string,
  previewId: string,
  updates: any
): Promise<any> => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/report/preview/${previewId}`,
    method: 'PUT',
    headers: getAuthHeaders(),
    data: updates
  });
  return unwrapApiData(res);
};

// Generate PDF from preview
export const generateConsultationReportPreviewPdf = async (
  consultationId: string,
  previewId: string
): Promise<Blob> => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/report/preview/${previewId}/generate`,
    method: 'POST',
    headers: getAuthHeaders(),
    responseType: 'blob'
  });
  return res.data;
};

// Approve SOAP note
export const approveSoapNote = async (
  consultationId: string,
  approved: boolean
): Promise<{ success: boolean; message: string }> => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/approve-soap`,
    method: 'POST',
    headers: getAuthHeaders(),
    data: { approved }
  });
  return res.data; // This endpoint doesn't use the standard data wrapper
};