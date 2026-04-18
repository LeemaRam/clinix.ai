import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 5000),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/clinix_ai',
  JWT_SECRET: process.env.JWT_SECRET || 'jwt-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  PYTHON_AI_SERVICE_URL: process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/subscription/success',
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/subscription/cancel',
  UPLOAD_AUDIO_DIR: process.env.UPLOAD_AUDIO_DIR || 'uploads/audio',
  UPLOAD_REPORTS_DIR: process.env.UPLOAD_REPORTS_DIR || 'uploads/reports',
  MAX_UPLOAD_SIZE_MB: Number(process.env.MAX_UPLOAD_SIZE_MB || 1024)
};
