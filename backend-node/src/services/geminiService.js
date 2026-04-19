import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

let geminiClient = null;
let geminiInitAttempted = false;
let geminiInitializedSuccessfully = false;

const getModelCandidates = () => {
  return [env.GEMINI_MODEL, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
    .map((model) => String(model || '').trim())
    .filter(Boolean)
    .filter((model, index, items) => items.indexOf(model) === index);
};

const fallbackSoap = (transcript = '') => ({
  subjective: String(transcript || '').trim() || 'No transcript provided.',
  objective: 'No objective findings documented.',
  assessment: 'AI analysis unavailable; using fallback SOAP structure.',
  plan: 'Review transcript manually and update SOAP note.',
  medications_mentioned: [],
  follow_up_days: 7
});

const parseJsonObject = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start < 0 || end < 0 || end <= start) return null;
    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const normalizeSoap = (candidate, transcript = '') => {
  const fallback = fallbackSoap(transcript);
  if (!candidate || typeof candidate !== 'object') return fallback;

  return {
    subjective: String(candidate.subjective ?? fallback.subjective),
    objective: String(candidate.objective ?? fallback.objective),
    assessment: String(candidate.assessment ?? fallback.assessment),
    plan: String(candidate.plan ?? fallback.plan),
    medications_mentioned: Array.isArray(candidate.medications_mentioned)
      ? candidate.medications_mentioned.map((item) => String(item)).filter(Boolean)
      : [],
    follow_up_days: Number.isFinite(Number(candidate.follow_up_days))
      ? Number(candidate.follow_up_days)
      : 7
  };
};

const getGeminiClient = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    if (!geminiInitAttempted) {
      console.error('Gemini initialization failed');
      geminiInitAttempted = true;
    }
    throw new Error('Gemini API key not configured');
  }

  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenerativeAI(apiKey);
    } catch (error) {
      console.error('Gemini initialization failed');
      throw error;
    }
  }

  return geminiClient;
};

const runGeminiPrompt = async (requestPayload) => {
  const client = getGeminiClient();
  let lastError = null;

  for (const modelName of getModelCandidates()) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(requestPayload);
      if (!geminiInitializedSuccessfully) {
        console.log('Gemini initialized successfully');
        geminiInitializedSuccessfully = true;
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  console.error('Gemini initialization failed');
  throw lastError || new Error('Failed to initialize Gemini model');
};

export const generateSimpleGeminiResponse = async (promptText) => {
  const result = await runGeminiPrompt(promptText);
  return String(result?.response?.text?.() || '').trim();
};

export const generateSOAP = async (transcript) => {
  const transcriptText = String(transcript || '').trim();
  if (!transcriptText) {
    return fallbackSoap('');
  }

  const prompt = [
    'Return ONLY a valid JSON object using this schema exactly:',
    '{"subjective":"","objective":"","assessment":"","plan":"","medications_mentioned":[],"follow_up_days":7}',
    'Use concise clinical SOAP language from the transcript below.',
    `Transcript: ${transcriptText}`
  ].join('\n');

  try {
    const result = await runGeminiPrompt({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const raw = String(result?.response?.text?.() || '');
    const parsed = parseJsonObject(raw);
    return normalizeSoap(parsed, transcriptText);
  } catch (error) {
    console.error('[geminiService] SOAP generation failed.', error);
    return fallbackSoap(transcriptText);
  }
};
