const makePattern = (parts: string[]) => new RegExp(parts.join('\\s+'), 'gi');

const BAD_PHRASES = [
  makePattern(['speech', 'recognition', 'failed']),
  makePattern(['ai', 'analysis', 'unavailable']),
  makePattern(['fallback', 'soap', 'structure']),
  makePattern(['fallback', 'reference']),
  makePattern(['configure', 'gemini_api_key']),
  makePattern(['unable', 'to', 'analyze', 'without', 'api', 'key'])
];

const DEFAULT_TEXT = 'No data available';

const collapseWhitespace = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const removeBadPhrases = (value: unknown) => {
  let text = collapseWhitespace(value);

  for (const pattern of BAD_PHRASES) {
    text = text.replace(pattern, '');
  }

  return collapseWhitespace(text.replace(/[\s\-:;,.]+$/g, ''));
};

export const formatSoapText = (value: unknown, fallback = DEFAULT_TEXT): string => {
  const cleaned = removeBadPhrases(value);
  if (!cleaned) return fallback;

  const normalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

export const formatSoapList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => formatSoapText(item, ''))
    .map((item) => item.replace(/[.!?]$/, ''))
    .filter(Boolean);
};

export const formatFollowUpDays = (value: unknown): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TEXT;
  return `${parsed} day${parsed === 1 ? '' : 's'}`;
};
