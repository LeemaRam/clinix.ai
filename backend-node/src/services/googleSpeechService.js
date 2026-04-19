import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { SpeechClient } from '@google-cloud/speech';
import { env } from '../config/env.js';

const resolveCredentialsPath = () => {
  const configuredPath = String(env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!configuredPath) return '';
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
};

const ensureCredentialsConfigured = () => {
  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    throw new Error('Google Speech credentials not configured');
  }
  return credentialsPath;
};

const getSpeechClient = () => {
  const credentialsPath = ensureCredentialsConfigured();
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  return new SpeechClient({ keyFilename: credentialsPath });
};

const readAudioBuffer = (audioFilePath) => {
  const resolvedPath = path.resolve(audioFilePath);
  const exists = fs.existsSync(resolvedPath);
  const stats = exists ? fs.statSync(resolvedPath) : null;
  const size = stats?.size || 0;

  console.log('[googleSpeechService] audio file path:', resolvedPath);
  console.log('[googleSpeechService] audio file size:', size);
  console.log('[googleSpeechService] audio file exists:', exists);

  if (!exists) {
    throw new Error('Audio file not found on server');
  }

  if (size <= 0) {
    throw new Error('Audio file is empty');
  }

  const audioBuffer = fs.readFileSync(resolvedPath);
  const bufferValid = Buffer.isBuffer(audioBuffer) && audioBuffer.length > 0;
  console.log('[googleSpeechService] file buffer valid:', bufferValid);

  if (!bufferValid) {
    throw new Error('Audio buffer is invalid');
  }

  return { resolvedPath, audioBuffer };
};

const parseTimeToSeconds = (timeLike) => {
  if (!timeLike) return 0;
  const seconds = Number.parseFloat(String(timeLike.seconds || 0));
  const nanos = Number.parseFloat(String(timeLike.nanos || 0));
  return seconds + nanos / 1e9;
};

const mapResultsToSegments = (results) => {
  return (results || []).map((result, index) => {
    const alt = result.alternatives?.[0] || {};
    const words = alt.words || [];
    const start = words.length > 0 ? parseTimeToSeconds(words[0].startTime) : index * 5;
    const end = words.length > 0 ? parseTimeToSeconds(words[words.length - 1].endTime) : start + 5;

    return {
      start,
      end,
      text: String(alt.transcript || '').trim()
    };
  }).filter((segment) => segment.text.length > 0);
};

const makeRequestConfig = ({ mimeType }) => {
  const isMp3 = String(mimeType || '').toLowerCase() === 'audio/mpeg' || String(mimeType || '').toLowerCase() === 'audio/mp3';
  const encoding = isMp3 ? 'MP3' : 'LINEAR16';
  const sampleRateHertz = isMp3 ? 44100 : 16000;
  const languageCode = 'en-US';

  console.log('[googleSpeechService] encoding type used:', encoding);
  console.log('[googleSpeechService] sample rate:', sampleRateHertz);
  console.log('[googleSpeechService] languageCode:', languageCode);

  return { encoding, sampleRateHertz, languageCode };
};

const buildRecognitionRequest = ({ audioBuffer, mimeType }) => {
  const audioContent = audioBuffer.toString('base64');
  console.log('[googleSpeechService] request payload size (base64 chars):', audioContent.length);

  const config = makeRequestConfig({ mimeType });
  return {
    audio: { content: audioContent },
    config: {
      ...config,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true
    }
  };
};

export const transcribeAudioWithGoogleSpeech = async ({ audioFilePath, speechLanguage = 'en', mimeType = '' }) => {
  if (!audioFilePath) {
    throw new Error('Audio file path is required for transcription');
  }

  const sttClient = getSpeechClient();
  const { resolvedPath, audioBuffer } = readAudioBuffer(audioFilePath);
  const request = buildRecognitionRequest({ audioBuffer, mimeType });

  console.log('[googleSpeechService] request will use file:', resolvedPath);

  try {
    let response;
    try {
      const [operation] = await sttClient.longRunningRecognize(request);
      [response] = await operation.promise();
    } catch (error) {
      console.error('[googleSpeechService] longRunningRecognize failed, falling back to recognize.', error?.message || error);
      [response] = await sttClient.recognize(request);
    }

    const results = response?.results || [];
    const transcript = results
      .map((result) => String(result.alternatives?.[0]?.transcript || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    const confidenceValues = results
      .map((result) => Number(result.alternatives?.[0]?.confidence || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      transcript,
      confidence: confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : 0.85,
      language: 'en-US',
      segments: mapResultsToSegments(results)
    };
  } catch (error) {
    console.error('[googleSpeechService] Google API error response:', error?.response?.data || error?.message || error);
    throw new Error(error?.message || 'Google Speech transcription failed');
  }
};
