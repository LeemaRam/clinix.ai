import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { formatSOAP, formatSoapText } from './soapFormatter.js';

const DEFAULT_MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

const summarizeTranscript = (transcript = '') => {
  const cleaned = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No data available';
  return cleaned.length > 280 ? `${cleaned.slice(0, 280)}...` : cleaned;
};

const fallbackAnalysis = (transcript = '') => ({
  subjective: summarizeTranscript(transcript),
  objective: 'No data available',
  assessment: 'No data available',
  plan: 'No data available',
  medications_mentioned: [],
  follow_up_days: 7
});

const toDays = (value) => {
  const parsed = Number.parseInt(String(value ?? 7), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 7;
  return parsed;
};

const normalizeAnalysis = (candidate, transcript = '') => {
  const base = fallbackAnalysis(transcript);

  if (!candidate || typeof candidate !== 'object') {
    return base;
  }

  const normalized = formatSOAP({
    subjective: candidate.subjective ?? base.subjective,
    objective: candidate.objective ?? base.objective,
    assessment: candidate.assessment ?? base.assessment,
    plan: candidate.plan ?? base.plan,
    medications_mentioned: Array.isArray(candidate.medications_mentioned) ? candidate.medications_mentioned : [],
    follow_up_days: toDays(candidate.follow_up_days)
  });

  return normalized;
};

const parseJsonObject = (value) => {
  if (!value || typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

export const extractMedicalAnalysis = async (transcript) => {
  const transcriptText = String(transcript || '').trim();
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  const modelCandidates = [env.GEMINI_MODEL, ...DEFAULT_MODEL_CANDIDATES]
    .map((model) => String(model || '').trim())
    .filter(Boolean)
    .filter((model, index, array) => array.indexOf(model) === index);

  if (!apiKey) {
    console.error('[medicalAnalysisService] GEMINI_API_KEY missing. Returning safe default SOAP analysis.');
    return formatSOAP(fallbackAnalysis(transcriptText));
  }

  if (!transcriptText) {
    return formatSOAP(fallbackAnalysis(''));
  }

  const prompt = [
    'You are an expert clinical documentation assistant for outpatient consultations.',
    'Task: Convert transcript text into a SOAP-style JSON object with high medical clarity.',
    'Return STRICTLY valid JSON only. No markdown, no prose, no code fences, no extra keys.',
    'Use concise, clinically accurate language.',
    'Extract medications_mentioned as distinct medication names explicitly mentioned in transcript.',
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
    '  "follow_up_days": 0',
    '}',
    '',
    'Few-shot example 1:',
    'Input transcript:',
    '"Patient says she has burning urination for two days and frequency. No flank pain and no fever. On exam, suprapubic tenderness is mild. I will start nitrofurantoin 100 mg twice daily for 5 days, increase water intake, and review in 3 days."',
    'Output JSON:',
    '{"subjective":"Burning urination and urinary frequency for 2 days; denies flank pain or fever.","objective":"Mild suprapubic tenderness on examination.","assessment":"Likely uncomplicated lower urinary tract infection.","plan":"Start nitrofurantoin 100 mg BID for 5 days, encourage hydration, and reassess symptoms.","medications_mentioned":["nitrofurantoin"],"follow_up_days":3}',
    '',
    'Few-shot example 2:',
    'Input transcript:',
    '"He reports dry cough for one week, worse at night, no chest pain or shortness of breath. Vitals are stable, chest is clear. Continue cetirizine at night and use steam inhalation. Come back after 10 days if not better."',
    'Output JSON:',
    '{"subjective":"Dry cough for 1 week, worse at night; no chest pain or dyspnea.","objective":"Vitals stable and chest clear on auscultation.","assessment":"Upper airway cough syndrome/allergic cough likely.","plan":"Continue cetirizine nightly, advise steam inhalation, and monitor symptom progression.","medications_mentioned":["cetirizine"],"follow_up_days":10}',
    '',
    'Now process the next transcript and return ONLY JSON.',
    '',
    'Transcript:',
    transcriptText
  ].join('\n');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        });

        const raw = result?.response?.text?.() || '';
        const parsed = parseJsonObject(raw);
        if (!parsed) {
          console.error(`[medicalAnalysisService] Gemini response from model ${modelName} was not valid JSON.`);
          continue;
        }
        return normalizeAnalysis(parsed, transcriptText);
      } catch (error) {
        console.error(`[medicalAnalysisService] Gemini model ${modelName} request failed.`, error);
      }
    }

    console.error('[medicalAnalysisService] All configured Gemini models failed. Returning safe default SOAP analysis.');
    return formatSOAP(fallbackAnalysis(transcriptText));
  } catch (error) {
    console.error('[medicalAnalysisService] Gemini API request failed. Returning safe default SOAP analysis.', error);
    return formatSOAP(fallbackAnalysis(transcriptText));
  }
};
