// Small reusable validators for Clinix.ai frontend forms.
// Validators return a human-readable error string, or null when the value is valid.
// They mirror the backend rules in backend-node/src/utils/validation.js.

export const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ.'\- ]{2,60}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_NORMALIZED_REGEX = /^\+[1-9]\d{7,14}$/;

export interface NameOptions { required?: boolean; label?: string }
export interface EmailOptions { required?: boolean }
export interface PhoneOptions { required?: boolean }
export interface TextOptions { required?: boolean; label?: string; min?: number; max?: number }

export const validateName = (
  value: string | null | undefined,
  { required = true, label = 'Name' }: NameOptions = {}
): string | null => {
  const v = String(value ?? '').trim();
  if (!v) return required ? `${label} is required.` : null;
  if (v.length < 2) return `${label} must be at least 2 characters.`;
  if (v.length > 60) return `${label} must be at most 60 characters.`;
  if (!NAME_REGEX.test(v)) {
    return `${label} can only contain letters, spaces, hyphens, apostrophes, and dots.`;
  }
  return null;
};

export const normalizeEmail = (value: string | null | undefined): string =>
  String(value ?? '').trim().toLowerCase();

export const validateEmail = (
  value: string | null | undefined,
  { required = true }: EmailOptions = {}
): string | null => {
  const v = normalizeEmail(value);
  if (!v) return required ? 'Email is required.' : null;
  if (v.length > 120) return 'Email must be at most 120 characters.';
  if (/\s/.test(v) || !EMAIL_REGEX.test(v)) return 'Enter a valid email address.';
  return null;
};

export const validatePassword = (value: string | null | undefined): string | null => {
  const v = String(value ?? '');
  if (!v) return 'Password is required.';
  if (v.length < 8) return 'Password must be at least 8 characters.';
  if (v.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Z]/.test(v)) return 'Password must include an uppercase letter.';
  if (!/[a-z]/.test(v)) return 'Password must include a lowercase letter.';
  if (!/[0-9]/.test(v)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Password must include a special character.';
  return null;
};

export const validatePasswordConfirm = (
  password: string | null | undefined,
  confirm: string | null | undefined
): string | null => {
  if (String(password ?? '') !== String(confirm ?? '')) {
    return 'Passwords do not match.';
  }
  return null;
};

// Normalizes a phone number to E.164. Accepts PK-style 03XXXXXXXXX too.
// Returns the original cleaned input if normalization fails so callers can show it back.
export const normalizePhone = (value: string | null | undefined): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '');
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2).replace(/\D/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) return '+92' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('92')) return '+' + digits;
  if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
  return cleaned;
};

export const validatePhone = (
  value: string | null | undefined,
  { required = true }: PhoneOptions = {}
): string | null => {
  const v = String(value ?? '').trim();
  if (!v) return required ? 'Phone number is required.' : null;
  const normalized = normalizePhone(v);
  if (!PHONE_NORMALIZED_REGEX.test(normalized)) return 'Enter a valid phone number.';
  return null;
};

export const validateDateOfBirth = (value: string | null | undefined): string | null => {
  const v = String(value ?? '').trim();
  if (!v) return 'Date of birth is required.';
  const dob = new Date(v);
  if (Number.isNaN(dob.getTime())) return 'Enter a valid date of birth.';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dobDay = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  if (dobDay >= today) return 'Date of birth cannot be today or in the future.';
  const ageYears = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < 0 || ageYears > 120) return 'Age must be between 0 and 120 years.';
  return null;
};

export const validateFutureDateTime = (
  date: string | null | undefined,
  time?: string | null | undefined
): string | null => {
  const d = String(date ?? '').trim();
  if (!d) return 'Date is required.';
  const t = time ? String(time).trim() : '';
  const composed = t ? `${d}T${t}` : d;
  const parsed = new Date(composed);
  if (Number.isNaN(parsed.getTime())) return 'Enter a valid date.';
  const now = new Date();
  if (t) {
    if (parsed.getTime() < now.getTime()) return 'Date and time cannot be in the past.';
  } else {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsed < today) return 'Date cannot be in the past.';
  }
  return null;
};

export const validateRequiredText = (
  value: string | null | undefined,
  { label = 'This field', min = 1, max = 3000 }: TextOptions = {}
): string | null => {
  const v = String(value ?? '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return null;
};

export const validateOptionalText = (
  value: string | null | undefined,
  { label = 'This field', max = 3000 }: Omit<TextOptions, 'required' | 'min'> = {}
): string | null => {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return null;
};

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'mp4'];
export const AUDIO_MIME_TYPES = new Set<string>([
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/aac'
]);

export interface FileValidationOptions {
  maxSizeMB?: number;
  mimes?: Set<string>;
  extensions?: string[];
}

export const validateFileUpload = (
  file: File | null | undefined,
  opts: FileValidationOptions = {}
): string | null => {
  if (!file) return 'Please select a file.';
  if (file.size === 0) return 'The selected file is empty.';
  const maxMB = opts.maxSizeMB ?? 50;
  if (file.size > maxMB * 1024 * 1024) return `File is too large. Max ${maxMB} MB.`;
  const allowedMimes = opts.mimes ?? AUDIO_MIME_TYPES;
  const allowedExt = opts.extensions ?? AUDIO_EXTENSIONS;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mimeOk = file.type ? allowedMimes.has(file.type) : true;
  const extOk = allowedExt.includes(ext);
  if (!mimeOk && !extOk) return 'Unsupported file type.';
  return null;
};

export const calculateAge = (dob: string | null | undefined): number => {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const passed = now.getMonth() > d.getMonth()
    || (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
  if (!passed) age -= 1;
  return Math.max(0, age);
};
