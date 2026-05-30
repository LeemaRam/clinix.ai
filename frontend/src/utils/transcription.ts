export const normalizeTranscription = (input: any) => {
  if (!input) return null;

  const rawText = String(
    input?.raw_text ||
    input?.rawText ||
    input?.transcript ||
    input?.text ||
    input?.full_text ||
    input?.transcription ||
    input?.transcription_text ||
    ''
  ).trim();

  const segments = Array.isArray(input?.segments) ? input.segments : [];

  return {
    ...input,
    raw_text: rawText,
    rawText,
    transcript: rawText,
    text: rawText,
    full_text: rawText,
    transcription: rawText,
    transcription_text: rawText,
    segments,
    confidence_score: Number(input?.confidence_score || input?.confidence || 0),
    duration: Number(input?.duration || input?.audio_duration || input?.audioDuration || 0),
    language: String(input?.language || input?.lang || 'en'),
    status: String(input?.status || 'unknown')
  };
};

export const getTranscriptionText = (input: any): string => {
  if (!input) return '';
  return String(
    input?.raw_text ||
    input?.rawText ||
    input?.transcript ||
    input?.text ||
    input?.full_text ||
    input?.transcription ||
    input?.transcription_text ||
    ''
  ).trim();
};

export const getTranscriptionSegments = (input: any): any[] => {
  if (!input) return [];
  return Array.isArray(input.segments) ? input.segments : [];
};
