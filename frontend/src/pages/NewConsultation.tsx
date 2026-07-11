import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, User, UserPlus, CheckCircle, AlertTriangle, Loader2, Upload, Globe, X, ArrowRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConsentForm from '../components/consultation/ConsentForm';
import RecordingTypeSelector from '../components/consultation/RecordingTypeSelector';
import { listPatients, createPatient } from '../services/patientService';
import { getSocket, joinConsultationRoom, leaveConsultationRoom } from '../services/socket';
import axios from 'axios';
import {
  validateName,
  validateDateOfBirth,
  validateFileUpload,
  AUDIO_EXTENSIONS,
  AUDIO_MIME_TYPES
} from '../utils/validation';

// Patient type matching backend
interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  lastVisit: string;
  currentMedications?: string[];
}

// Add these interfaces at the top of the file after existing interfaces
interface AddPatientData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
}

interface PatientResponse {
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
    last_visit?: string;
  };
}

interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

interface PatientsResponse {
  patients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
    last_visit?: string;
  }>;
}

interface ConsultationResponse {
  consultation: {
    id: string;
    patient_id: string;
    consultation_type: string;
    recording_type: string;
    consent_obtained: boolean;
    status: string;
    created_at: string;
  };
}

interface AudioUploadResponse {
  success: boolean;
  message: string;
  transcription_job_id?: string;
}

const API_URL = String(import.meta.env.VITE_API_URL || '').trim();
const shouldUseProxy = (() => {
  if (!API_URL) return true;
  try {
    const { hostname } = new URL(API_URL);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
})();

const apiRoot = shouldUseProxy ? '/api' : `${API_URL}/api`;
const PENDING_CONSULTATION_STORAGE_KEY = 'clinix_pending_consultation';

// Add API service functions
const api = {
  getAuthHeaders: () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
};

const NewConsultation = () => {
  const { t } = useTranslation();
  const { patientId } = useParams<{ patientId?: string }>();
  const navigate = useNavigate();

  // Handle API errors
  const handleError = (error: unknown): Error => {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;
      return new Error(apiError?.message || apiError?.error || error.message || t('common.errorOccurredWithRequest'));
    }
    return error instanceof Error ? error : new Error(t('subscription.unexpectedErrorOccurred'));
  };

  // Patient state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientMedications, setPatientMedications] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // Add patient form
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [addPatientData, setAddPatientData] = useState<AddPatientData>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: ''
  });
  const [addPatientLoading, setAddPatientLoading] = useState(false);
  const [addPatientError, setAddPatientError] = useState<string | null>(null);

  // Consent, recording type, speech language and recording state
  const [consentObtained, setConsentObtained] = useState(false);
  const [recordingType, setRecordingType] = useState('doctor_patient');
  const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<BlobPart[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);

  // Submission state
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submittedConsultationId, setSubmittedConsultationId] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  // Recording and upload state
  const [recordingMode, setRecordingMode] = useState<'record' | 'upload'>('record');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Loading modal state
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskCurrentStep, setTaskCurrentStep] = useState('');
  const [taskStatus, setTaskStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');

  // Cleanup effect for media resources and timers
  useEffect(() => {
    return () => {
      // Clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Clean up media recorder
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      // Clean up audio URL
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }

      // Clean up socket room
      if (submittedConsultationId) {
        leaveConsultationRoom(submittedConsultationId);
      }
    };
  }, [mediaRecorder, audioURL, submittedConsultationId]);

  useEffect(() => {
    const socket = getSocket();
    const handleProgress = (event: any) => {
      if (!event || !event.consultationId) return;
      if (submittedConsultationId && event.consultationId !== submittedConsultationId) return;

      setTaskCurrentStep(event.currentStep || 'processing');
      setTaskProgress(Number(event.progress || 0));
      const status = event.status || 'processing';
      setTaskStatus(status as any);

      if (status === 'completed' || status === 'partial') {
        setSubmitSuccess('AI processing completed. Your consultation is ready.');
        setAutoRedirectCountdown(10);
        setShowLoadingModal(false);
        localStorage.removeItem(PENDING_CONSULTATION_STORAGE_KEY);
      }

      if (status === 'failed') {
        setSubmitError('AI processing failed. Please check the consultation details and try again.');
        setShowLoadingModal(false);
        localStorage.removeItem(PENDING_CONSULTATION_STORAGE_KEY);
      }
    };

    socket.on('transcription_progress', handleProgress);
    socket.on('ai_task_status', handleProgress);

    return () => {
      socket.off('transcription_progress', handleProgress);
      socket.off('ai_task_status', handleProgress);
    };
  }, [submittedConsultationId]);

  useEffect(() => {
    const restoreConsultationId = localStorage.getItem(PENDING_CONSULTATION_STORAGE_KEY);
    if (!restoreConsultationId) return;

    setSubmittedConsultationId(restoreConsultationId);
    joinConsultationRoom(restoreConsultationId);

    const fetchTask = async () => {
      try {
        const response = await axios.get(
          `${apiRoot}/consultations/${restoreConsultationId}/ai-task`,
          { headers: api.getAuthHeaders() }
        );
        const payload = (response.data as any)?.data || response.data;
        const task = payload?.task;
        if (!task) {
          setSubmittedConsultationId(null);
          localStorage.removeItem(PENDING_CONSULTATION_STORAGE_KEY);
          return;
        }

        setTaskProgress(Number(task.progress || 0));
        setTaskCurrentStep(task.currentStep || 'queued');
        setTaskStatus(task.status || 'queued');
        if (task.status === 'queued' || task.status === 'processing') {
          setShowLoadingModal(true);
          setLoadingStage('processing');
          setLoadingMessage('Restoring AI processing state...');
        }
        if (task.status === 'completed' || task.status === 'partial') {
          setSubmitSuccess('AI processing completed. Your consultation is ready.');
          setAutoRedirectCountdown(10);
          setShowLoadingModal(false);
          localStorage.removeItem(PENDING_CONSULTATION_STORAGE_KEY);
        }
        if (task.status === 'failed') {
          setSubmitError('AI processing failed. Please check the consultation details and try again.');
          setShowLoadingModal(false);
          localStorage.removeItem(PENDING_CONSULTATION_STORAGE_KEY);
        }
      } catch (error) {
        console.warn('Failed to restore AI task state:', error);
      }
    };

    fetchTask();
  }, []);

  // Preload patient if patientId is provided in URL
  useEffect(() => {
    if (patientId && patients.length > 0) {
      const preloadPatient = patients.find(p => p.id === patientId);
      if (preloadPatient) {
        setSelectedPatient(preloadPatient);
        setPatientMedications(preloadPatient.currentMedications || []);
      }
    }
  }, [patientId, patients]);

  // Cleanup recording resources on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  // Debug effect to monitor recording time changes
  useEffect(() => {
    console.log('Recording time changed:', recordingTime);
  }, [recordingTime]);

  // Auto-redirect countdown effect
  useEffect(() => {
    if (autoRedirectCountdown === null) return;

    if (autoRedirectCountdown === 0) {
      // Time's up, redirect to past consultations
      navigate('/past-consultations');
      return;
    }

    // Countdown timer
    const timer = setTimeout(() => {
      setAutoRedirectCountdown(prev => prev! - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoRedirectCountdown, navigate]);

  const fetchPatients = async () => {
    setPatientsLoading(true);
    setPatientsError(null);
    try {
      const payload = await listPatients({ page: 1, limit: 100 });

      setPatients(
        (payload.patients || []).map((p) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          dob: p.date_of_birth,
          gender: p.gender,
          lastVisit: p.last_visit || '',
          currentMedications: p.current_medications || []
        }))
      );
    } catch (error) {
      const err = handleError(error);
      setPatientsError(err.message);
    } finally {
      setPatientsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Patient search and select
  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add new patient
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    // Input validation
    const validationError =
      validateName(addPatientData.first_name, { label: t('patients.firstName') })
      || validateName(addPatientData.last_name, { label: t('patients.lastName') })
      || validateDateOfBirth(addPatientData.date_of_birth)
      || (!addPatientData.gender ? t('validation.genderRequired') : null);
    if (validationError) {
      setAddPatientError(validationError);
      return;
    }

    setAddPatientLoading(true);
    setAddPatientError(null);

    try {
      const patient = await createPatient(addPatientData);

      // Reset form and update state
      setShowAddPatient(false);
      setAddPatientData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: ''
      });

      // Refresh patient list and select new patient
      await fetchPatients();
      setSelectedPatient({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        dob: patient.date_of_birth,
        gender: patient.gender,
        lastVisit: patient.last_visit || ''
      });
    } catch (error) {
      setAddPatientError(handleError(error).message);
    } finally {
      setAddPatientLoading(false);
    }
  };

  // Audio recording logic
  const startRecording = async () => {
    setAudioError(null);
    setAudioBlob(null);
    setAudioURL(null);
    setRecordingTime(0);
    setAudioChunks([]);
    audioChunksRef.current = [];
    
    // Clear previous submission state
    setSubmitSuccess(null);
    setSubmittedConsultationId(null);
    setSubmitError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new window.MediaRecorder(stream, { mimeType: 'audio/webm' });
      setMediaRecorder(recorder);

      // Clear previous chunks and start fresh
      setAudioChunks([]);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          setAudioChunks(prev => [...prev, e.data]);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());

        // Create the final blob from all chunks using the ref
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          setAudioURL(URL.createObjectURL(blob));
        }
        setMediaRecorder(null);
      };

      // Start recording with 1 second timeslice to ensure data is available
      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);

      // Start timer AFTER recording has started
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setTimeout(() => {
        timerRef.current = window.setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current)/1000);
          setRecordingTime(elapsedSeconds);
        }, 100);
      }, 100);

    } catch (e: any) {
      // If there's an error, stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
              setAudioError(t('common.microphoneAccessDenied'));
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);

      // Stop the timer and record the pause start time
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);

      // Calculate total paused time and restart timer
      const pauseEndTime = Date.now();
      const currentRecordingTime = recordingTime * 1000; // Convert back to milliseconds
      startTimeRef.current = pauseEndTime - currentRecordingTime;

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsedSeconds);
      }, 100);
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording, final time:', recordingTime);
    setIsRecording(false);
    setIsPaused(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    
    // Clear previous submission state
    setSubmitSuccess(null);
    setSubmittedConsultationId(null);
    setSubmitError(null);
    
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type and size using shared helper
    const fileError = validateFileUpload(file, {
      maxSizeMB: 50,
      extensions: AUDIO_EXTENSIONS,
      mimes: AUDIO_MIME_TYPES
    });
    if (fileError) {
      setUploadError(fileError);
      return;
    }

    setSelectedFile(file);
    setAudioBlob(file);
    setAudioURL(URL.createObjectURL(file));
  };

  // Modified submit handler to handle both recording and file upload
  const handleSubmit = async () => {
    if (!selectedPatient || (!audioBlob && !selectedFile)) {
      setSubmitError(t('common.missingPatientOrAudio'));
      return;
    }
    if (!consentObtained) {
      setSubmitError(t('validation.consentRequired'));
      return;
    }

    // Validate audio duration - prevent 0 second audio uploads
    if (recordingMode === 'record' && recordingTime < 1) {
      setSubmitError(t('common.audioRecordingTooShort'));
      return;
    }

    // Additional validation for audio blob content
    if (recordingMode === 'record' && audioBlob !== null && audioBlob.size < 1000) {
      setSubmitError(t('common.audioRecordingEmpty'));
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    
    // Show loading modal
    setShowLoadingModal(true);
    setLoadingProgress(0);
    setLoadingStage('preparing');
    setLoadingMessage('Preparing consultation...');

    try {
      // Simulate progress for consultation creation
      setLoadingProgress(20);
      setLoadingStage('creating');
      setLoadingMessage('Creating consultation...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Create consultation
      const consultationResponse = await axios.post<ConsultationResponse>(
        `${apiRoot}/consultations`,
        {
          patient_id: selectedPatient.id,
          consultation_type: 'general',
          recording_type: recordingType,
          consent_obtained: consentObtained
        },
        { headers: api.getAuthHeaders() }
      );

      const consultationPayload = (consultationResponse.data as any)?.data || consultationResponse.data;
      const { consultation } = consultationPayload;

      // Simulate progress for audio preparation
      setLoadingProgress(40);
      setLoadingStage('uploading');
      setLoadingMessage('Preparing audio for upload...');
      await new Promise(resolve => setTimeout(resolve, 600));

      // Upload audio
      const formData = new FormData();
      // Handle both Blob and File types
      const audioFile = audioBlob || selectedFile;
      if (!audioFile) {
        throw new Error(t('common.noAudioFileAvailable'));
      }

      // Determine the file extension
      const fileExtension = selectedFile ? selectedFile.name.split('.').pop() || 'webm' : 'webm';
      formData.append('audio', audioFile, `consultation.${fileExtension}`);
      formData.append('recording_type', recordingType);
      formData.append('speech_language', speechLanguage);

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Accept': 'application/json'
      };

      // Simulate progress for upload
      setLoadingProgress(60);
      setLoadingMessage('Uploading audio file...');
      await new Promise(resolve => setTimeout(resolve, 400));

      const audioResponse = await axios.post<AudioUploadResponse>(
        `${apiRoot}/consultations/${consultation.id}/upload-audio`,
        formData,
        { headers, timeout: 600000 }
      );

      if (!audioResponse.data.success) {
        throw new Error(audioResponse.data.error || audioResponse.data.message || t('common.failedToUploadAudio'));
      }

      setSubmittedConsultationId(consultation.id);
      localStorage.setItem(PENDING_CONSULTATION_STORAGE_KEY, consultation.id);
      setSubmitSuccess('Consultation uploaded. AI processing will continue in the background.');
      setTaskStatus('queued');
      setTaskProgress(10);
      setTaskCurrentStep('queued');
      setShowLoadingModal(false);
      setLoadingProgress(0);
      setLoadingStage('processing');
      setLoadingMessage('AI processing started. You will receive realtime updates.');
      joinConsultationRoom(consultation.id);

      // Keep submit flow non-blocking. Background AI updates will arrive over socket events.
      setAudioBlob(null);
      setAudioURL(null);
      setSelectedFile(null);
      setRecordingTime(0);

    } catch (error) {
      const err = handleError(error);
      setSubmitError(err.message);
      setCanRetry(true);

      // If it's a network error, offer retry
      if (err.isNetworkError) {
        setSubmitError(`${err.message}. Please check your connection and try again.`);
      }

      setShowLoadingModal(false);

      // Clean up any partial state
      if (submittedConsultationId) {
        localStorage.removeItem(PENDING_CONSULTATION_STORAGE_KEY);
        setSubmittedConsultationId(null);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  // Patient age helper
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

  // Patient date format
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Loading Modal Component
  const LoadingModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {loadingStage === 'completed' ? 'Success!' : 'Processing...'}
            </h3>
            {loadingStage !== 'completed' && (
              <button
                onClick={() => setShowLoadingModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                {loadingStage === 'preparing' && 'Preparation'}
                {loadingStage === 'creating' && 'Creating Consultation'}
                {loadingStage === 'uploading' && 'Uploading Audio'}
                {loadingStage === 'transcribing' && 'Initiating Transcription'}
                {loadingStage === 'completed' && 'Completed'}
              </span>
              <span className="text-sm font-medium text-gray-500">{loadingProgress}%</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-700 ease-out rounded-full ${
                  loadingStage === 'completed' 
                    ? 'bg-gradient-to-r from-green-400 to-green-600' 
                    : 'bg-gradient-to-r from-cyan-400 to-blue-600'
                }`}
                style={{ width: `${loadingProgress}%` }}
              />
              {loadingStage !== 'completed' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" />
              )}
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center mb-6">
            {loadingStage === 'completed' ? (
              <div className="flex flex-col items-center animate-in zoom-in duration-500">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-in scale-in duration-500">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  Upload Successful!
                </h4>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Your consultation has been submitted and transcription has been initiated.
                  <br />
                  <span className="font-medium">Check your past consultations to view the results.</span>
                </p>
                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowLoadingModal(false);
                      setLoadingProgress(0);
                      setLoadingStage('');
                      setLoadingMessage('');
                      navigate('/past-consultations');
                    }}
                    className="px-6 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    View Consultation(s)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Loader2 size={32} className="text-cyan-600 animate-spin" />
                </div>
                <p className="text-gray-700 font-medium">{loadingMessage}</p>
              </div>
            )}
          </div>

          {/* Stage Indicators */}
          {loadingStage !== 'completed' && (
            <div className="space-y-3">
              <div className={`flex items-center ${loadingStage === 'preparing' ? 'text-cyan-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  loadingStage === 'preparing' ? 'bg-cyan-100' : 'bg-gray-100'
                }`}>
                  {loadingStage === 'preparing' ? <Loader2 size={14} className="animate-spin" /> : '1'}
                </div>
                <span className="text-sm">Preparing consultation</span>
              </div>
              
              <div className={`flex items-center ${loadingStage === 'creating' ? 'text-cyan-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  loadingStage === 'creating' ? 'bg-cyan-100' : 'bg-gray-100'
                }`}>
                  {loadingStage === 'creating' ? <Loader2 size={14} className="animate-spin" /> : '2'}
                </div>
                <span className="text-sm">Creating consultation</span>
              </div>
              
              <div className={`flex items-center ${loadingStage === 'uploading' ? 'text-cyan-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  loadingStage === 'uploading' ? 'bg-cyan-100' : 'bg-gray-100'
                }`}>
                  {loadingStage === 'uploading' ? <Loader2 size={14} className="animate-spin" /> : '3'}
                </div>
                <span className="text-sm">Uploading audio</span>
              </div>
              
              <div className={`flex items-center ${loadingStage === 'transcribing' ? 'text-cyan-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  loadingStage === 'transcribing' ? 'bg-cyan-100' : 'bg-gray-100'
                }`}>
                  {loadingStage === 'transcribing' ? <Loader2 size={14} className="animate-spin" /> : '4'}
                </div>
                <span className="text-sm">Initiating transcription</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6">
      {/* Loading Modal */}
      {showLoadingModal && <LoadingModal />}

      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">New Consultation</h1>
        <p className="text-sm md:text-base text-gray-600">{t('common.recordNewPatientConsultation')}</p>
      </div>

      {/* 1. Select Patient */}
      <div className="p-4 md:p-6 mb-4 md:mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="mb-3 md:mb-4 text-base md:text-lg font-semibold text-gray-800">1. Select Patient</h2>
        {patientsLoading ? (
          <div className="flex items-center text-cyan-600"><Loader2 className="mr-2 animate-spin" />Loading patients...</div>
        ) : patientsError ? (
          <div className="text-red-600">{patientsError}</div>
        ) : selectedPatient ? (
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 font-medium rounded-full bg-cyan-100 text-cyan-600">
                {selectedPatient.name.substring(0, 2)}
              </div>
              <div className="ml-4">
                <p className="text-lg font-medium text-gray-800">{selectedPatient.name}</p>
                <p className="text-sm text-gray-500">
                  {getAge(selectedPatient.dob)} years • {selectedPatient.gender} • Last visit: {formatDate(selectedPatient.lastVisit)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedPatient(null)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Search for a patient by name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 300)} // Increased delay to allow clicks
                className="w-full py-2 pl-10 pr-4 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
              />
              <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
            {(searchTerm || isSearchFocused) && (
              <div className="mt-2 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg max-h-64">
                {/* Show filtered patients if search term exists, otherwise show all patients */}
                {(searchTerm ? filteredPatients : patients).length > 0 ? (
                  (searchTerm ? filteredPatients : patients).map(patient => (
                    <div
                      key={patient.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur from firing
                        setSelectedPatient(patient);
                        setIsSearchFocused(false);
                        setSearchTerm('');
                      }}
                      className="flex items-center p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 last:border-b-0"
                    >
                      <div className="flex items-center justify-center w-10 h-10 font-medium rounded-full bg-cyan-100 text-cyan-600">
                        {patient.name.substring(0, 2)}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-800">{patient.name}</p>
                        <p className="text-xs text-gray-500">
                          {getAge(patient.dob)} years • {patient.gender} • Last visit: {formatDate(patient.lastVisit)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    {searchTerm 
                      ? "No patients found. Try a different search term." 
                      : "No patients available. Add a new patient below."
                    }
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <div className="mt-4">
          {showAddPatient ? (
            <form onSubmit={handleAddPatient} className="p-4 mt-2 space-y-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-2">
                <input required type="text" placeholder="First Name" value={addPatientData.first_name} onChange={e => setAddPatientData(d => ({ ...d, first_name: e.target.value }))} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                <input required type="text" placeholder="Last Name" value={addPatientData.last_name} onChange={e => setAddPatientData(d => ({ ...d, last_name: e.target.value }))} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input required type="date" placeholder="Date of Birth" value={addPatientData.date_of_birth} onChange={e => setAddPatientData(d => ({ ...d, date_of_birth: e.target.value }))} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                <select required value={addPatientData.gender} onChange={e => setAddPatientData(d => ({ ...d, gender: e.target.value }))} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {addPatientError && <div className="text-sm text-red-600">{addPatientError}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={addPatientLoading} className="px-4 py-1 text-white rounded bg-cyan-600 hover:bg-cyan-700">
                  {addPatientLoading ? <Loader2 className="inline-block mr-1 animate-spin" size={16} /> : null} Add
                </button>
                <button type="button" onClick={() => setShowAddPatient(false)} className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setShowAddPatient(true)} className="flex items-center text-cyan-600 hover:text-cyan-700">
              <UserPlus size={18} className="mr-2" />
              <span>Add new patient</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Patient Consent */}
      <div className="p-4 md:p-6 mb-4 md:mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="mb-3 md:mb-4 text-base md:text-lg font-semibold text-gray-800">2. Patient Consent</h2>
        <ConsentForm onConsentObtained={setConsentObtained} />
      </div>

      {/* 3. Recording Type */}
      <div className="p-4 md:p-6 mb-4 md:mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="mb-3 md:mb-4 text-base md:text-lg font-semibold text-gray-800">{t('consultation.recordingType')}</h2>
        <RecordingTypeSelector onTypeSelected={setRecordingType} />
      </div>

      {/* 4. Speech Language Selection */}
      <div className="p-4 md:p-6 mb-4 md:mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="mb-3 md:mb-4 text-base md:text-lg font-semibold text-gray-800">{t('consultation.selectLanguage')}</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('consultation.selectSpeechLanguage')}</p>
          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-cyan-600" />
            <select
              value={speechLanguage}
              onChange={(e) => setSpeechLanguage(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="en-US">{t('speech.languages.en-US')}</option>
              <option value="ur-PK">{t('speech.languages.ur-PK')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6. Record or Upload Consultation */}
      <div className="p-4 md:p-6 mb-4 md:mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="mb-3 md:mb-4 text-base md:text-lg font-semibold text-gray-800">{t('consultation.recordOrUpload')}</h2>
        {selectedPatient && consentObtained ? (
          <>
            <div className="flex flex-col items-center justify-center mb-8">
              {/* Recording Mode Toggle */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 md:mb-6">
                <button
                  onClick={() => setRecordingMode('record')}
                  className={`px-4 py-2 rounded-lg transition-colors ${recordingMode === 'record'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  Record Audio
                </button>
                <button
                  onClick={() => setRecordingMode('upload')}
                  className={`px-4 py-2 rounded-lg transition-colors ${recordingMode === 'upload'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  Upload Audio
                </button>
              </div>

              {/* Recording Interface */}
              {recordingMode === 'record' && (
                <div className="flex flex-col items-center">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isRecording && !isPaused
                    ? 'bg-red-100 text-red-600 animate-pulse'
                    : isPaused
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                    {isRecording ? (
                      <MicOff size={48} className="cursor-pointer" />
                    ) : (
                      <Mic size={48} className="cursor-pointer" />
                    )}
                  </div>
                  <div className="mt-4 text-center">
                    {audioError && <div className="mb-2 text-red-600">{audioError}</div>}
                    {isRecording ? (
                      <>
                        <p className={`text-lg font-semibold ${isPaused ? 'text-yellow-600' : 'text-red-600'}`}>
                          {isPaused ? 'Recording paused' : 'Recording in progress'}
                        </p>
                        <p className="mt-2 text-3xl font-bold">{formatTime(recordingTime)}</p>
                        <div className="flex gap-2 mt-4">
                          {!isPaused ? (
                            <button
                              onClick={pauseRecording}
                              className="px-6 py-2 text-white transition-colors bg-yellow-600 rounded-lg hover:bg-yellow-700"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={resumeRecording}
                              className="px-6 py-2 text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
                            >
                              Resume
                            </button>
                          )}
                          <button
                            onClick={stopRecording}
                            className="px-6 py-2 text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700"
                          >
                            Stop
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-gray-800">Ready to record</p>
                        <button
                          onClick={startRecording}
                          className="px-6 py-2 mt-4 text-white transition-colors rounded-lg bg-cyan-600 hover:bg-cyan-700"
                        >
                          Start Recording
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Interface */}
              {recordingMode === 'upload' && (
                <div className="flex flex-col items-center">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200"
                  >
                    <Upload size={36} className="md:w-12 md:h-12" />
                  </div>
                  <div className="mt-4 text-center">
                    {uploadError && <div className="mb-2 text-red-600">{uploadError}</div>}
                    <p className="text-base md:text-lg font-semibold text-gray-800">
                      {selectedFile ? selectedFile.name : t('common.selectAudioFile')}
                    </p>
                    {!selectedFile && (
                      <p className="mt-1 text-xs text-gray-500">
                        {t('common.supportedAudioFormats')} · {t('common.maxFileSize')}
                      </p>
                    )}
                    {selectedFile && (
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setAudioBlob(null);
                          setAudioURL(null);
                          setSubmitSuccess(null);
                          setSubmittedConsultationId(null);
                          setSubmitError(null);
                        }}
                        className="px-4 py-1 mt-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        {t('common.removeFile')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Audio Preview and Submit */}
            {(audioBlob || selectedFile) && !isRecording && (
              <div className="flex flex-col items-center gap-2">
                {audioURL && <audio src={audioURL} controls className="mx-auto my-2" />}
                {recordingMode === 'record' && (
                  <div className="text-center mb-2">
                    <p className="text-sm text-gray-600">Recording Duration: {formatTime(recordingTime)}</p>
                    {recordingTime < 1 && (
                      <p className="text-sm text-red-600">{t('common.recordingTooShort')}</p>
                    )}
                    {audioBlob && (
                      <button
                        onClick={() => {
                          setAudioBlob(null);
                          setAudioURL(null);
                          setRecordingTime(0);
                          setSubmitSuccess(null);
                          setSubmittedConsultationId(null);
                          setSubmitError(null);
                        }}
                        className="px-3 py-1 mt-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        {t('common.removeRecording')}
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={recordingMode === 'record' && (recordingTime < 1 || (audioBlob !== null && audioBlob.size < 1000))}
                  className={`w-full sm:w-auto px-4 sm:px-6 py-2 text-white transition-colors rounded-lg ${
                    (recordingMode === 'record' && (recordingTime < 1 || (audioBlob !== null && audioBlob.size < 1000)))
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {t('common.submitForTranscription')}
                </button>
                
                {/* Error Message */}
                {submitError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-red-700">
                        <AlertTriangle size={16} className="mr-2" />
                        <span className="text-sm">{submitError}</span>
                      </div>
                      {canRetry && (
                        <button
                          onClick={() => {
                            setSubmitError(null);
                            setCanRetry(false);
                            handleSubmit();
                          }}
                          className="ml-3 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          {t('common.retry')}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {submitSuccess && (
                  <div className="mt-3 p-6 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-center text-green-700 mb-4">
                      <CheckCircle size={24} className="mr-3" />
                      <span className="font-semibold text-lg">{submitSuccess}</span>
                    </div>
                    {submittedConsultationId && (
                      <div className="text-center">
                        <div className="mb-4 p-3 bg-white/70 rounded-lg border border-green-200">
                          <div className="text-sm text-gray-600 mb-1">Consultation ID:</div>
                          <div className="font-mono text-sm bg-green-100 px-3 py-2 rounded font-medium text-green-800">
                            {submittedConsultationId}
                          </div>
                        </div>
                        
                        <div className="mb-4 text-sm text-gray-700">
                          Your consultation has been uploaded and AI processing is running in the background.
                          Realtime progress will update on this screen while the task completes.
                        </div>
                        {taskStatus !== 'idle' && (
                          <div className="mb-4 p-4 bg-white/90 rounded-lg border border-gray-200">
                            <div className="text-sm font-semibold text-gray-800 mb-2">Processing status</div>
                            <div className="mb-2 text-sm text-gray-600">Step: {taskCurrentStep || 'processing'}</div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                              <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.min(100, taskProgress)}%` }} />
                            </div>
                            <div className="mt-2 text-xs text-gray-500">{Math.min(100, taskProgress)}% complete</div>
                          </div>
                        )}
                        
                        {autoRedirectCountdown !== null && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-sm text-blue-700 text-center">
                              <span className="font-medium">Auto-redirecting to Past Consultations in {autoRedirectCountdown} seconds</span>
                              <button
                                onClick={() => setAutoRedirectCountdown(null)}
                                className="ml-2 text-xs underline hover:no-underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            onClick={() => {
                              setAutoRedirectCountdown(null);
                              navigate('/past-consultations');
                            }}
                            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                          >
                            <ArrowRight size={16} className="mr-2" />
                            View Past Consultations
                          </button>
                          <button
                            onClick={() => {
                              setAutoRedirectCountdown(null);
                              setSubmitSuccess(null);
                              setSubmittedConsultationId(null);
                              setAudioBlob(null);
                              setAudioURL(null);
                              setSelectedFile(null);
                              setRecordingTime(0);
                              setSubmitError(null);
                              setSelectedPatient(null);
                              setConsentObtained(false);
                              setRecordingType('doctor_patient');
                              setSpeechLanguage('en-US');
                            }}
                            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-green-700 bg-white hover:bg-green-50 border border-green-300 rounded-lg transition-colors shadow-sm"
                          >
                            <Plus size={16} className="mr-2" />
                            Start New Consultation
                          </button>
                        </div>
                        
                        <div className="mt-4 text-xs text-gray-500">
                          The transcription process may take a few minutes to complete.
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </>
        ) : (
          <div className="flex items-center p-4 rounded-lg text-amber-600 bg-amber-50">
            <AlertTriangle size={18} className="mr-2" />
            <span>{t('common.selectPatientAndObtainConsent')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewConsultation;