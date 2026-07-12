import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { env } from '../config/env.js';

const resolveAudioPath = (audioFilePath) => {
  const resolvedPath = path.resolve(audioFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error('Audio file not found on server');
  }
  return resolvedPath;
};

const buildWhisperForm = ({ audioFilePath, speechLanguage }) => {
  const formData = new FormData();
  const resolvedPath = resolveAudioPath(audioFilePath);
  const fileStream = fs.createReadStream(resolvedPath);

  formData.append('file', fileStream, {
    filename: path.basename(resolvedPath),
    contentType: 'application/octet-stream'
  });
  formData.append('model', env.OPENAI_WHISPER_MODEL);
  if (speechLanguage) {
    formData.append('language', speechLanguage);
  }

  return formData;
};

export const transcribeAudioWithWhisper = async ({ audioFilePath, speechLanguage = 'en' }) => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured for Whisper transcription');
  }

  const formData = buildWhisperForm({ audioFilePath, speechLanguage });
  const url = `${env.OPENAI_API_BASE_URL}/audio/transcriptions`;
  const headers = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    ...formData.getHeaders()
  };

  const response = await axios.post(url, formData, {
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  const data = response.data;
  const transcript = String(data.text || '').trim();

  return {
    transcript,
    raw_text: transcript,
    confidence: Number(data.confidence || 0),
    language: speechLanguage,
    segments: transcript ? [{ start: 0, end: transcript.length ? Math.max(1, transcript.length / 50) : 0, text: transcript }] : [],
    model_used: env.OPENAI_WHISPER_MODEL,
    duration: 0,
  };
};
