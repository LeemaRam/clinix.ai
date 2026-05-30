const makePattern = (parts) => new RegExp(parts.join('\\s+'), 'gi');

const BAD_PHRASES = [
  makePattern(['speech', 'recognition', 'failed']),
  makePattern(['ai', 'analysis', 'unavailable']),
  makePattern(['fallback', 'soap', 'structure']),
  makePattern(['fallback', 'reference']),
  makePattern(['unable', 'to', 'analyze', 'without', 'api', 'key'])
];

const DEFAULT_TEXT = 'No data available';

export const cleanWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const stripBadContent = (value) => {
  let text = cleanWhitespace(value);

  for (const pattern of BAD_PHRASES) {
    text = text.replace(pattern, '');
  }

  return cleanWhitespace(text.replace(/[\s\-:;,.]+$/g, ''));
};

export const sentenceCase = (value) => {
  const text = stripBadContent(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const formatSoapText = (value, fallback = DEFAULT_TEXT) => {
  const cleaned = sentenceCase(value);
  if (!cleaned) return fallback;
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
};

export const formatSoapList = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => formatSoapText(item, ''))
    .map((item) => item.replace(/[.!?]$/, ''))
    .filter(Boolean);
};

export const formatSOAP = (soapData = {}) => {
  const source = (soapData && typeof soapData === 'object') ? soapData : {};
  const sourceMedicalInfo = (source.medical_info && typeof source.medical_info === 'object') ? source.medical_info : {};

  return {
    subjective: formatSoapText(source.subjective),
    objective: formatSoapText(source.objective),
    assessment: formatSoapText(source.assessment),
    plan: formatSoapText(source.plan),
    medications_mentioned: formatSoapList(source.medications_mentioned),
    follow_up_days: Number.isFinite(Number(source.follow_up_days)) && Number(source.follow_up_days) >= 0
      ? Number(source.follow_up_days)
      : 7,
    medical_info: {
      symptoms: formatSoapList(sourceMedicalInfo.symptoms),
      medical_history: formatSoapList(sourceMedicalInfo.medical_history),
      current_medications: formatSoapList(sourceMedicalInfo.current_medications),
      diagnosis: formatSoapList(sourceMedicalInfo.diagnosis),
      treatment_plan: formatSoapList(sourceMedicalInfo.treatment_plan),
      follow_up: formatSoapList(sourceMedicalInfo.follow_up)
    }
  };
};

export const isNoDataAvailable = (value) => !stripBadContent(value) || stripBadContent(value).toLowerCase() === DEFAULT_TEXT.toLowerCase();
