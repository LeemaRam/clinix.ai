import axios from 'axios';
import { env } from '../config/env.js';
import { transcribeAudioWithGoogleSpeech } from './googleSpeechService.js';

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
    const response = await transcribeAudioWithGoogleSpeech({ audioFilePath, speechLanguage, mimeType });
    const transcript = String(response.transcript || '').trim();
    const segments = Array.isArray(response.segments)
      ? response.segments.map((segment, index) => ({
        id: index + 1,
        start: Number(segment.start || 0),
        end: Number(segment.end || 0),
        text: String(segment.text || '').trim(),
        speaker: 'unknown'
      })).filter((segment) => segment.text)
      : [];
    const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;

    if (!transcript) {
      throw new Error('Empty transcript from Google Speech API');
    }

    return {
      success: true,
      transcript,
      segments,
      raw_text: transcript,
      confidence_score: Number(response.confidence || 0),
      duration,
      language: String(response.language || speechLanguage),
      model_used: 'google-cloud-speech',
      fallback: false
    };
  } catch (error) {
    const message = error?.message || 'Google Speech transcription failed';
    console.error('[pythonService] Real transcription failed in non-demo mode.', message);
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

export const checkDrugSafety = async ({ medications, patientInfo = {}, language = 'en' }) => {
  const { data } = await client.post('/drug-safety', {
    medications,
    patient_info: patientInfo,
    language
  });

  return data;
};
