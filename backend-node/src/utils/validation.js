// Small reusable validators for Clinix.ai backend (Node/Express).
// Each validator returns a human-readable error string, or null when the value is valid.
// Helpers mirror the frontend rules in frontend/src/utils/validation.ts.

import { ApiError } from './ApiError.js';

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ.'\- ]{2,60}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_NORMALIZED_REGEX = /^\+[1-9]\d{7,14}$/;

export const validateName = (value, { required = true, label = 'Name' } = {}) => {
  const v = String(value ?? '').trim();
  if (!v) return required ? `${label} is required` : null;
  if (v.length < 2) return `${label} must be at least 2 characters`;
  if (v.length > 60) return `${label} must be at most 60 characters`;
  if (!NAME_REGEX.test(v)) {
    return `${label} can only contain letters, spaces, hyphens, apostrophes, and dots`;
  }
  return null;
};

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

export const validateEmail = (value, { required = true } = {}) => {
  const v = normalizeEmail(value);
  if (!v) return required ? 'Email is required' : null;
  if (v.length > 120) return 'Email must be at most 120 characters';
  if (/\s/.test(v) || !EMAIL_REGEX.test(v)) return 'Enter a valid email address';
  return null;
};

export const validatePassword = (value) => {
  const v = String(value ?? '');
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (v.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Z]/.test(v)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(v)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(v)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Password must include a special character';
  return null;
};

export const normalizePhone = (value) => {
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

export const validatePhone = (value, { required = true } = {}) => {
  const v = String(value ?? '').trim();
  if (!v) return required ? 'Phone number is required' : null;
  const normalized = normalizePhone(v);
  if (!PHONE_NORMALIZED_REGEX.test(normalized)) return 'Enter a valid phone number';
  return null;
};

export const validateDateOfBirth = (value) => {
  const v = String(value ?? '').trim();
  if (!v) return 'Date of birth is required';
  const dob = new Date(v);
  if (Number.isNaN(dob.getTime())) return 'Enter a valid date of birth';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dobDay = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  if (dobDay >= today) return 'Date of birth cannot be today or in the future';
  const ageYears = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < 0 || ageYears > 120) return 'Age must be between 0 and 120 years';
  return null;
};

export const validateFutureDateTime = (date, time) => {
  const d = String(date ?? '').trim();
  if (!d) return 'Date is required';
  const t = time ? String(time).trim() : '';
  const composed = t ? `${d}T${t}` : d;
  const parsed = new Date(composed);
  if (Number.isNaN(parsed.getTime())) return 'Enter a valid date';
  const now = new Date();
  if (t) {
    if (parsed.getTime() < now.getTime()) return 'Date and time cannot be in the past';
  } else {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsed < today) return 'Date cannot be in the past';
  }
  return null;
};

export const validateText = (
  value,
  { required = false, label = 'Field', min = 0, max = 3000 } = {}
) => {
  const v = String(value ?? '').trim();
  if (!v) return required ? `${label} is required` : null;
  if (v.length < min) return `${label} must be at least ${min} characters`;
  if (v.length > max) return `${label} must be at most ${max} characters`;
  return null;
};

export const validateEnum = (value, allowed, { required = true, label = 'Field' } = {}) => {
  const v = String(value ?? '').trim();
  if (!v) return required ? `${label} is required` : null;
  if (!allowed.includes(v)) return `${label} must be one of: ${allowed.join(', ')}`;
  return null;
};

// Build an errors object from an array of [field, message] pairs.
// Returns null when no field has an error.
export const collectErrors = (entries) => {
  const errors = {};
  for (const [field, message] of entries) {
    if (message) errors[field] = message;
  }
  return Object.keys(errors).length ? errors : null;
};

export const throwIfErrors = (errors, statusMessage = 'Validation failed') => {
  if (errors) throw new ApiError(400, statusMessage, errors);
};
