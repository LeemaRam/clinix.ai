import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 5000),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/clinix_ai',
  JWT_SECRET: process.env.JWT_SECRET || 'jwt-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyCwMtgAg6PvSFrcVl_R5ZneZ0PjZhoZ3ZU',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_WHISPER_MODEL: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || './secrets/google-speech.json',
  PYTHON_AI_SERVICE_URL: process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/subscription/success',
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/subscription/cancel',
  UPLOAD_AUDIO_DIR: process.env.UPLOAD_AUDIO_DIR || 'uploads/audio',
  UPLOAD_REPORTS_DIR: process.env.UPLOAD_REPORTS_DIR || 'uploads/reports',
  MAX_UPLOAD_SIZE_MB: Number(process.env.MAX_UPLOAD_SIZE_MB || 1024),
  OPENFDA_API_KEY: process.env.OPENFDA_API_KEY || '',
  RXNORM_API_ID: process.env.RXNORM_API_ID || '6745c86f-389a-4135-8432-119cc332c50a',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886' // Twilio sandbox number
};
