import OpenAI from 'openai';
import { env } from '../config/env.js';
import { cleanWhitespace, formatSOAP } from './soapFormatter.js';

const DEFAULT_MODEL = env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_LLM_OPTIONS = {
  model: DEFAULT_MODEL,
  temperature: 0.1,
  max_output_tokens: 1200
};

const openAiClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_API_BASE_URL
});

const getResponseText = (response) => {
  if (!response) return '';
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const outputItems = response.output;
  if (Array.isArray(outputItems) && outputItems.length > 0) {
    const textFragments = [];
    for (const item of outputItems) {
      if (!item) continue;
      if (typeof item === 'string') {
        textFragments.push(item);
        continue;
      }
      if (Array.isArray(item.content)) {
        for (const block of item.content) {
          if (typeof block?.text === 'string') {
            textFragments.push(block.text);
          }
        }
      }
    }
    const text = textFragments.join(' ').trim();
    if (text) return text;
  }

  return '';
};

const parseJson = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    const candidate = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (innerError) {
      return null;
    }
  }
};

const safeCreateResponse = async ({ input, maxTokens = 1200, temperature = 0.1 }) => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await openAiClient.responses.create({
    model: DEFAULT_MODEL,
    input,
    max_output_tokens: maxTokens,
    temperature
  });

  return getResponseText(response);
};

const fallbackSoap = (transcript = '') => ({
  subjective: cleanWhitespace(transcript) || 'No data available',
  objective: 'No data available',
  assessment: 'No data available',
  plan: 'No data available',
  medications_mentioned: [],
  follow_up_days: 7,
  medical_info: {
    symptoms: [],
    medical_history: [],
    current_medications: [],
    diagnosis: [],
    treatment_plan: [],
    follow_up: []
  }
});

export const generateSimpleOpenAIResponse = async (promptText) => {
  const prompt = String(promptText || 'Say OK in one word.').trim();
  const rawOutput = await safeCreateResponse({ input: prompt, maxTokens: 32, temperature: 0.0 });
  return rawOutput;
};

export const extractMedicalAnalysis = async (transcript) => {
  const transcriptText = String(transcript || '').trim();
  if (!transcriptText) {
    return formatSOAP(fallbackSoap(''));
  }

  const prompt = [
    'You are an expert clinical documentation assistant for outpatient consultations.',
    'Convert the transcript text into a SOAP-style JSON object with high medical clarity.',
    'Return STRICTLY valid JSON only. No markdown, no prose, no code fences, no extra keys.',
    'Use concise, clinically accurate language.',
    'Extract medications_mentioned as distinct medication names explicitly mentioned in the transcript.',
    'Extract follow_up_days as an integer number of days.',
    'If follow-up timing is not explicitly stated, use 7.',
    'If no medications are mentioned, return an empty array.',
    'Schema (must match exactly):',
    '{',
    '  "subjective": "...",',
    '  "objective": "...",',
    '  "assessment": "...",',
    '  "plan": "...",',
    '  "medications_mentioned": [],',
    '  "follow_up_days": 0,',
    '  "medical_info": {',
    '    "symptoms": [],',
    '    "medical_history": [],',
    '    "current_medications": [],',
    '    "diagnosis": [],',
    '    "treatment_plan": [],',
    '    "follow_up": []',
    '  }',
    '}',
    '',
    'Input transcript:',
    transcriptText
  ].join('\n');

  try {
    const rawOutput = await safeCreateResponse({ input: prompt, maxTokens: 500, temperature: 0.0 });
    const parsed = parseJson(rawOutput);
    return formatSOAP(parsed || fallbackSoap(transcriptText));
  } catch (error) {
    console.error('[openaiService] extractMedicalAnalysis failed:', error?.message || error);
    return formatSOAP(fallbackSoap(transcriptText));
  }
};

export const generateSOAPNote = async ({ patient = {}, transcription = '', consultationReason = '' }) => {
  const patientJson = JSON.stringify(patient || {});
  const transcriptText = String(transcription || '').trim();
  const reason = String(consultationReason || 'general').trim();

  const prompt = [
    'You are an experienced medical documentation assistant.',
    'Produce a concise SOAP note based on patient context and consultation transcript.',
    'Output only the SOAP note text. No markdown, no JSON, no code fences.',
    '',
    'Patient details:',
    patientJson,
    '',
    'Consultation reason:',
    reason,
    '',
    'Transcript:',
    transcriptText
  ].join('\n');

  try {
    const soapNote = await safeCreateResponse({ input: prompt, maxTokens: 700, temperature: 0.2 });
    return { soapNote: cleanWhitespace(soapNote), rawResponse: soapNote };
  } catch (error) {
    console.error('[openaiService] generateSOAPNote failed:', error?.message || error);
    return { soapNote: '', rawResponse: null };
  }
};

export const generatePatientBrief = async ({ patient = {}, recentConsultations = [], reports = [], patientFiles = [] }) => {
  const payload = {
    patient,
    recentConsultations,
    reports,
    patientFiles
  };

  const prompt = [
    'You are an expert clinical summarization assistant.',
    'Produce a concise patient brief using the provided patient profile, recent consultations, reports, and patient file summaries.',
    'Return STRICTLY valid JSON only with keys:',
    '{',
    '  "brief": "...",',
    '  "highlights": ["..."],',
    '  "summary": "..."',
    '}',
    '',
    'Data:',
    JSON.stringify(payload)
  ].join('\n');

  try {
    const rawOutput = await safeCreateResponse({ input: prompt, maxTokens: 700, temperature: 0.2 });
    const parsed = parseJson(rawOutput);
    return parsed || { brief: '', highlights: [], summary: '' };
  } catch (error) {
    console.error('[openaiService] generatePatientBrief failed:', error?.message || error);
    return { brief: '', highlights: [], summary: '' };
  }
};

export const checkDrugSafety = async ({ medications = [], patientInfo = {}, patientFiles = [], language = 'en' }) => {
  const prompt = [
    'You are a drug safety assistant. Review the medication list, patient information, and any provided patient files.',
    'Return STRICTLY valid JSON only with keys: warnings, interactions, recommendations.',
    'Each key should contain an array of concise strings. If there are no items, return an empty array.',
    '',
    'Patient information:',
    JSON.stringify(patientInfo),
    '',
    'Medications:',
    JSON.stringify(medications),
    '',
    'Patient files:',
    JSON.stringify(patientFiles),
    '',
    `Language: ${language}`
  ].join('\n');

  try {
    const rawOutput = await safeCreateResponse({ input: prompt, maxTokens: 500, temperature: 0.2 });
    const parsed = parseJson(rawOutput);
    return parsed || { warnings: [], interactions: [], recommendations: [] };
  } catch (error) {
    console.error('[openaiService] checkDrugSafety failed:', error?.message || error);
    return { warnings: [], interactions: [], recommendations: [] };
  }
};

export const extractFollowupDetails = async (soapNote) => {
  const noteText = typeof soapNote === 'string' ? soapNote : JSON.stringify(soapNote || {});
  const prompt = [
    'You are a clinical follow-up assistant.',
    'Extract follow_up_days and follow_up_reason from the SOAP note or medical analysis text.',
    'Return STRICTLY valid JSON only with keys: follow_up_days, follow_up_reason.',
    'If a follow-up schedule is not clear, use 7 days and "Routine follow-up after consultation".',
    '',
    'SOAP note or medical analysis:',
    noteText
  ].join('\n');

  try {
    const rawOutput = await safeCreateResponse({ input: prompt, maxTokens: 200, temperature: 0.0 });
    const parsed = parseJson(rawOutput);
    if (!parsed) return { follow_up_days: 7, follow_up_reason: 'Routine follow-up after consultation' };
    return {
      follow_up_days: Number.isFinite(Number(parsed.follow_up_days)) ? Number(parsed.follow_up_days) : 7,
      follow_up_reason: String(parsed.follow_up_reason || 'Routine follow-up after consultation').trim()
    };
  } catch (error) {
    console.error('[openaiService] extractFollowupDetails failed:', error?.message || error);
    return { follow_up_days: 7, follow_up_reason: 'Routine follow-up after consultation' };
  }
};
