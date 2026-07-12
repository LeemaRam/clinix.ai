import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Required environment variables for production
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI'
];

// Validate required environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Environment configuration with secure defaults
export const env = {
  // Server
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // CORS - Require explicit configuration in production
  CORS_ORIGIN: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000'),

  // Frontend URL for Socket.IO
  FRONTEND_URL: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000'),

  // AI Services
  PYTHON_AI_SERVICE_URL: process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8001',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  OPENAI_WHISPER_MODEL: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',

  // Google Cloud
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || './secrets/google-speech.json',
  GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY || '',

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/subscription/success',
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/subscription/cancel',

  // Upload Configuration
  UPLOAD_AUDIO_DIR: process.env.UPLOAD_AUDIO_DIR || 'uploads/audio',
  UPLOAD_REPORTS_DIR: process.env.UPLOAD_REPORTS_DIR || 'uploads/reports',
  MAX_UPLOAD_SIZE_MB: Number(process.env.MAX_UPLOAD_SIZE_MB || 50),

  // External APIs
  OPENFDA_API_KEY: process.env.OPENFDA_API_KEY || '',
  RXNORM_API_ID: process.env.RXNORM_API_ID || '',

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || '',
  // Public URL Twilio calls for WhatsApp webhook signature validation (must match exactly).
  TWILIO_WEBHOOK_URL: process.env.TWILIO_WEBHOOK_URL || '',
  // When true, reject unsigned/invalid webhook requests. Production always validates.
  // In development, set TWILIO_WEBHOOK_VALIDATE=false to allow local simulated requests.
  TWILIO_WEBHOOK_VALIDATE:
    (process.env.NODE_ENV || 'development') === 'production'
      ? true
      : process.env.TWILIO_WEBHOOK_VALIDATE !== 'false',

  // Demo Mode
  DEMO_MODE: process.env.DEMO_MODE === 'true',

  // Reminder runner security
  REMINDER_RUN_SECRET: process.env.REMINDER_RUN_SECRET || '',

  // Super admin bootstrap account (optional)
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || '',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || '',
  SUPER_ADMIN_FULL_NAME: process.env.SUPER_ADMIN_FULL_NAME || 'Super Admin'
};

// Validate CORS configuration in production
if (env.NODE_ENV === 'production' && !env.CORS_ORIGIN) {
  console.error('❌ CORS_ORIGIN must be configured in production environment');
  process.exit(1);
}

if (env.NODE_ENV === 'production' && !env.FRONTEND_URL) {
  console.error('❌ FRONTEND_URL must be configured in production environment');
  process.exit(1);
}
