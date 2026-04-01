import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { env } from '../config/env.js';

const client = axios.create({
  baseURL: env.PYTHON_AI_SERVICE_URL,
  timeout: 600000
});

export const transcribeAudio = async ({ audioFilePath, speechLanguage = 'en', consultationId }) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(audioFilePath));
  form.append('speech_language', speechLanguage);
  form.append('consultation_id', consultationId);

  const { data } = await client.post('/transcribe', form, {
    headers: form.getHeaders()
  });

  return data;
};

export const generateReport = async ({ transcriptionText, consultationType = 'general', language = 'en' }) => {
  const { data } = await client.post('/generate-report', {
    transcription_text: transcriptionText,
    consultation_type: consultationType,
    language
  });

  return data;
};
