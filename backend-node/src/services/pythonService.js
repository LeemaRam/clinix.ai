import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { env } from '../config/env.js';
import { transcribeAudioWithGoogleSpeech } from './googleSpeechService.js';
import { transcribeAudioWithWhisper } from './openaiWhisperService.js';

const client = axios.create({
  baseURL: env.PYTHON_AI_SERVICE_URL,
  timeout: 600000
});

const buildTranscribeForm = ({ audioFilePath, speechLanguage, consultationId, mimeType }) => {
  const resolvedPath = path.resolve(audioFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error('Audio file not found on server');
  }

  const formData = new FormData();
  const fileStream = fs.createReadStream(resolvedPath);
  const fileOptions = {
    filename: path.basename(resolvedPath),
    contentType: mimeType || 'application/octet-stream'
  };

  formData.append('file', fileStream, fileOptions);
  formData.append('speech_language', speechLanguage);
  if (consultationId) {
    formData.append('consultation_id', consultationId);
  }

  return formData;
};

const buildTranscribeUrl = () => `${env.PYTHON_AI_SERVICE_URL.replace(/\/+$/, '')}/transcribe`;

const DEMO_TRANSCRIPT = 'Demo mode transcript: Patient reports intermittent headache for three days, mild nausea, no fever, and took paracetamol with partial relief. Follow-up advised in seven days.';

const makeDemoPayload = ({ speechLanguage = 'en', consultationId, modelUsed = 'demo-local' }) => {
  const transcript = consultationId
    ? `${DEMO_TRANSCRIPT} Consultation reference: ${consultationId}.`
    : DEMO_TRANSCRIPT;

  return {
    transcript,
    segments: [{ id: 1, start: 0, end: 5, text: transcript, speaker: 'unknown' }],
    raw_text: transcript,
    confidence_score: 0.99,
    duration: 5,
    language: speechLanguage,
    model_used: modelUsed
  };
};

export const transcribeAudio = async ({ audioFilePath, speechLanguage = 'en', consultationId, mimeType }) => {
  if (env.DEMO_MODE) {
    return makeDemoPayload({ speechLanguage, consultationId, modelUsed: 'demo-local' });
  }

  if (!audioFilePath) {
    throw new Error('Audio file path is required for transcription');
  }

<<<<<<< HEAD
  const resolvedPath = path.resolve(audioFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error('Audio file not found on server');
=======
  try {
    let response;
    let modelUsed = 'google-cloud-speech';

    if (env.OPENAI_API_KEY) {
      response = await transcribeAudioWithWhisper({ audioFilePath, speechLanguage });
      modelUsed = env.OPENAI_WHISPER_MODEL;
    } else {
      response = await transcribeAudioWithGoogleSpeech({ audioFilePath, speechLanguage, mimeType });
    }

    const transcript = String(response.transcript || response.raw_text || '').trim();
    const segments = Array.isArray(response.segments)
      ? response.segments.map((segment, index) => ({
        id: index + 1,
        start: Number(segment.start || 0),
        end: Number(segment.end || 0),
        text: String(segment.text || '').trim(),
        speaker: 'unknown'
      })).filter((segment) => segment.text)
      : [];
    const duration = response.duration || (segments.length > 0 ? segments[segments.length - 1].end : 0);

    if (!transcript) {
      throw new Error('Empty transcript from transcription service');
    }

    return {
      success: true,
      transcript,
      segments,
      raw_text: transcript,
      confidence_score: Number(response.confidence || 0),
      duration,
      language: String(response.language || speechLanguage),
      model_used: modelUsed,
      fallback: false
    };
  } catch (error) {
    const message = error?.message || 'Transcription service failed';
    console.error('[pythonService] transcription failed.', message);
    throw Object.assign(new Error(message), { fallback: false });
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  }

  let response;
  let modelUsed = 'python-ai-service';

  try {
    const url = buildTranscribeUrl();
    const stats = fs.statSync(resolvedPath);
    console.log('[pythonService] Sending audio to FastAPI AI service:', url, {
      consultationId,
      speechLanguage,
      audioFilePath: resolvedPath,
      audioFileSize: stats.size,
      mimeType
    });

    const formData = buildTranscribeForm({ audioFilePath: resolvedPath, speechLanguage, consultationId, mimeType });
    const headers = formData.getHeaders();
    console.log('[pythonService] Built multipart form-data request headers', { ...headers });

    const serviceResponse = await client.post('/transcribe', formData, {
      headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    response = serviceResponse.data;
    console.log('[pythonService] Received transcription response from FastAPI AI service', {
      consultationId,
      responseData: response
    });
  } catch (error) {
    const errMsg = error?.response?.data || error?.message || String(error);
    console.error('[pythonService] FastAPI /transcribe request failed', {
      consultationId,
      speechLanguage,
      audioFilePath: resolvedPath,
      error: errMsg
    });
    if (env.PYTHON_AI_SERVICE_URL && env.OPENAI_API_KEY) {
      console.warn('[pythonService] FastAPI AI service failed, falling back to OpenAI Whisper:', error.message);
      response = await transcribeAudioWithWhisper({ audioFilePath, speechLanguage });
      modelUsed = env.OPENAI_WHISPER_MODEL;
    } else if (env.PYTHON_AI_SERVICE_URL && env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.warn('[pythonService] FastAPI AI service failed, falling back to Google Speech:', error.message);
      response = await transcribeAudioWithGoogleSpeech({ audioFilePath, speechLanguage, mimeType });
      modelUsed = 'google-cloud-speech';
    } else {
      const message = error?.message || 'Transcription service failed';
      console.error('[pythonService] transcription failed.', message);
      throw Object.assign(new Error(message), { fallback: false });
    }
  }

  const transcript = String(
    response.transcript ||
    response.raw_text ||
    response.text ||
    response.full_text ||
    response.transcription ||
    response.transcription_text ||
    response.data?.transcript ||
    response.data?.raw_text ||
    response.data?.text ||
    response.data?.full_text ||
    response.data?.transcription ||
    response.data?.transcription_text ||
    ''
  ).trim();

  const segmentsSource = response.segments || response.data?.segments || [];
  const segments = Array.isArray(segmentsSource)
    ? segmentsSource.map((segment, index) => ({
      id: Number(segment.id || index + 1),
      start: Number(segment.start || 0),
      end: Number(segment.end || 0),
      text: String(segment.text || segment.transcript || '').trim(),
      speaker: String(segment.speaker || 'unknown')
    })).filter((segment) => segment.text)
    : [];

  const duration = Number(
    response.duration ||
    response.audio_duration ||
    response.data?.duration ||
    response.data?.audio_duration ||
    (segments.length > 0 ? segments[segments.length - 1].end : 0)
  );

  if (!transcript) {
    throw new Error('Empty transcript from transcription service');
  }

  return {
    success: true,
    transcript,
    segments,
    raw_text: transcript,
    confidence_score: Number(response.confidence_score || response.confidence || 0),
    duration,
    language: String(response.language || speechLanguage),
    model_used: modelUsed,
    fallback: false
  };
};

export const generateReport = async ({ transcriptionText, consultationType = 'general', language = 'en' }) => {
  const { data } = await client.post('/generate-report', {
    transcription_text: transcriptionText,
    consultation_type: consultationType,
    language
  });

  return data;
};

export const checkDrugSafety = async ({ medications, patientInfo = {}, patientFiles = [], language = 'en' }) => {
  const { data } = await client.post('/drug-safety', {
    medications,
    patient_info: patientInfo,
    patient_files: patientFiles,
    language
  });

  return data;
};

<<<<<<< HEAD
export const checkDrugInteractions = async ({ newDrugs = [], existingDrugs = [] }) => {
  console.log('[pythonService] checkDrugInteractions request', {
    newDrugs: Array.isArray(newDrugs) ? newDrugs : [],
    existingDrugs: Array.isArray(existingDrugs) ? existingDrugs : []
  });

  const response = await client.post('/drug-check', {
    new_drugs: Array.isArray(newDrugs) ? newDrugs : [],
    existing_drugs: Array.isArray(existingDrugs) ? existingDrugs : []
  });

  console.log('[pythonService] checkDrugInteractions response', response.data);
  return response.data;
};

=======
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
export const generateSOAPNote = async ({ patient, transcription, consultationReason, existingNotes }) => {
  const { data } = await client.post('/soap-note', {
    patient,
    transcription,
    consultation_reason: consultationReason,
    existing_notes: existingNotes || null
  });

  return data;
};
