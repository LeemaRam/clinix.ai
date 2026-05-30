import { generateSOAPNote, generateSimpleOpenAIResponse } from '../services/openaiService.js';

const fallbackSoap = (transcript = '') => ({
  subjective: String(transcript || '').trim() || 'No transcript provided.',
  objective: 'No data available',
  assessment: 'No data available',
  plan: 'No data available',
  medications_mentioned: [],
  follow_up_days: 7
});

export const testOpenAI = async (_req, res) => {
  try {
    const output = await generateSimpleOpenAIResponse('Say OK in one word');
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const testOpenAISoap = async (req, res) => {
  const transcript = String(req.body?.transcript || '').trim();
  if (!transcript) {
    return res.status(400).json({ success: false, error: 'transcript is required' });
  }

  try {
    const soap = await generateSOAPNote({ patient: {}, transcription: transcript, consultationReason: 'test' });
    return res.json({ success: true, ...soap });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      ...fallbackSoap(transcript)
    });
  }
};
