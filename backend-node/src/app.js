import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
<<<<<<< HEAD
import rateLimit from 'express-rate-limit';
=======
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import consultationRoutes from './routes/consultationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import followupRoutes from './routes/followupRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import twilioWebhookRoutes from './routes/twilioWebhookRoutes.js';
import patientFileRoutes from './routes/patientFileRoutes.js';
import testRoutes from './routes/testRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

export const createApp = () => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.openai.com"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    hsts: env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
  }));

  // CORS configuration
  const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((x) => x.trim()).filter(Boolean) : [];
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must be configured in production');
  }

  app.use(
    cors({
      origin: isProduction ? allowedOrigins : true, // Allow all in development
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  // Body parsing with size limits
  const maxPayloadSize = `${env.MAX_UPLOAD_SIZE_MB}mb`;
  app.use(express.json({ limit: maxPayloadSize }));
  app.use(express.urlencoded({ extended: true, limit: maxPayloadSize }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to all requests
  app.use(limiter);

  // Stricter rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    skip: (req) => req.method === 'GET' && req.path === '/validate-token',
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Health check endpoint
  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'clinix-ai-api',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  const healthHandler = (_req, res) => {
    const dbStatus = mongoose.connection.readyState;
    const dbConnected = dbStatus === 1; // 1 = connected

<<<<<<< HEAD
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'ok' : 'error',
      service: 'backend-node',
      environment: env.NODE_ENV,
=======
    res.json({
      status: dbConnected ? 'ok' : 'error',
      service: 'clinix-ai-api',
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
      database: {
        connected: dbConnected,
        status: dbStatus === 0 ? 'disconnected' :
                dbStatus === 1 ? 'connected' :
                dbStatus === 2 ? 'connecting' :
                dbStatus === 3 ? 'disconnecting' : 'unknown'
      }
    });
  };

  // /health is used by the in-container docker healthcheck.
  // /api/health is the public health route exposed through the reverse proxy.
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/consultations', consultationRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api', subscriptionRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/followups', followupRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/webhooks', twilioWebhookRoutes);
  app.use('/api/patients', patientFileRoutes);  // already /api/patients prefix
  app.use('/api/test', testRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
