import axios from 'axios';
import { env } from '../config/env.js';
import { transcribeAudioWithGoogleSpeech } from './googleSpeechService.js';
import { transcribeAudioWithWhisper } from './openaiWhisperService.js';

const client = axios.create({
  baseURL: env.PYTHON_AI_SERVICE_URL,
  timeout: 600000
});

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
  }
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

export const generateSOAPNote = async ({ patient, transcription, consultationReason, existingNotes }) => {
  const { data } = await client.post('/soap-note', {
    patient,
    transcription,
    consultation_reason: consultationReason,
    existing_notes: existingNotes || null
  });

  return data;
};
