<<<<<<< HEAD
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { env } from '../config/env.js';

=======
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const guessMimeType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'audio/webm';
    case '.ogg':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
};

>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
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
<<<<<<< HEAD
  const fileStream = fs.createReadStream(resolvedPath);

  formData.append('file', fileStream, {
    filename: path.basename(resolvedPath),
    contentType: 'application/octet-stream'
  });
  formData.append('model', env.OPENAI_WHISPER_MODEL);
=======
  const audioBuffer = fs.readFileSync(resolvedPath);
  const mimeType = guessMimeType(resolvedPath);
  const audioFile = new File([audioBuffer], path.basename(resolvedPath), { type: mimeType });

  formData.append('file', audioFile);
  formData.append('model', env.OPENAI_WHISPER_MODEL);
  formData.append('response_format', 'verbose_json');
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  if (speechLanguage) {
    formData.append('language', speechLanguage);
  }

  return formData;
};

<<<<<<< HEAD
=======
export { buildWhisperForm };

const detectSpeaker = (text, prevSpeaker) => {
  // Heuristic-based speaker detection
  // Typically doctors ask questions, patients respond with symptoms/experiences
  const doctorPatterns = /^(what|when|how|where|do you|have you|are you|is there|can you|tell me|describe|explain|any|okay|alright|all right|so|uh)/i;
  const patientPatterns = /^(i|yes|no|about|since|it|well|yeah|well|um|uh yeah)/i;
  
  const isDoctor = doctorPatterns.test(text);
  const isPatient = patientPatterns.test(text);
  
  // If neither pattern matches, alternate from previous speaker
  if (!isDoctor && !isPatient) {
    return prevSpeaker === 'doctor' ? 'patient' : 'doctor';
  }
  
  // If only one pattern matches, use that
  if (isDoctor && !isPatient) return 'doctor';
  if (isPatient && !isDoctor) return 'patient';
  
  // If both match (edge case), alternate
  return prevSpeaker === 'doctor' ? 'patient' : 'doctor';
};

>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
export const transcribeAudioWithWhisper = async ({ audioFilePath, speechLanguage = 'en' }) => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured for Whisper transcription');
  }

  const formData = buildWhisperForm({ audioFilePath, speechLanguage });
  const url = `${env.OPENAI_API_BASE_URL}/audio/transcriptions`;
<<<<<<< HEAD
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
=======

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      // Note: do not set Content-Type manually when using FormData
    },
    body: formData
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Whisper transcription failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const transcript = String(data.text || '').trim();
  
  // Process segments with speaker detection
  let segments = [];
  let prevSpeaker = 'patient'; // Start with patient typically
  
  if (data.segments && Array.isArray(data.segments)) {
    segments = data.segments.map((seg, index) => {
      const speaker = detectSpeaker(seg.text || '', prevSpeaker);
      prevSpeaker = speaker;
      
      return {
        id: index,
        start: seg.start || 0,
        end: seg.end || 0,
        text: seg.text || '',
        speaker: speaker,
        confidence: seg.confidence || 0,
        no_speech_prob: seg.no_speech_prob || 0,
      };
    });
  } else if (transcript) {
    // Fallback: if no segments from API, create single segment
    segments = [{ 
      id: 0,
      start: 0, 
      end: Math.max(1, transcript.length / 50), 
      text: transcript,
      speaker: 'doctor',
      confidence: 0,
      no_speech_prob: 0,
    }];
  }
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

  return {
    transcript,
    raw_text: transcript,
    confidence: Number(data.confidence || 0),
    language: speechLanguage,
<<<<<<< HEAD
    segments: transcript ? [{ start: 0, end: transcript.length ? Math.max(1, transcript.length / 50) : 0, text: transcript }] : [],
    model_used: env.OPENAI_WHISPER_MODEL,
    duration: 0,
=======
    segments: segments,
    model_used: env.OPENAI_WHISPER_MODEL,
    duration: data.duration || 0,
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  };
};
