import { generateSOAP, generateSimpleGeminiResponse } from '../services/geminiService.js';

const fallbackSoap = (transcript = '') => ({
  subjective: String(transcript || '').trim() || 'No transcript provided.',
  objective: 'No objective findings documented.',
  assessment: 'AI analysis unavailable; using fallback SOAP structure.',
  plan: 'Review transcript manually and update SOAP note.',
  medications_mentioned: [],
  follow_up_days: 7
});

export const testGemini = async (_req, res) => {
  try {
    const output = await generateSimpleGeminiResponse('Say OK in one word');
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const testGeminiSoap = async (req, res) => {
  const transcript = String(req.body?.transcript || '').trim();
  if (!transcript) {
    return res.status(400).json({ success: false, error: 'transcript is required' });
  }

  try {
    const soap = await generateSOAP(transcript);
    return res.json({ success: true, ...soap });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      ...fallbackSoap(transcript)
    });
  }
};
