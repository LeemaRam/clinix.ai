import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import consultationRoutes from './routes/consultationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import userRoutes from './routes/userRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

export const createApp = () => {
  const app = express();

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((x) => x.trim()).filter(Boolean);
  const isWildcard = allowedOrigins.includes('*');
  app.use(
    cors({
      origin: isWildcard ? true : allowedOrigins,
      credentials: !isWildcard
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'clinix-ai-api', docs: '/health' });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clinix-ai-api' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/consultations', consultationRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api', subscriptionRoutes);
  app.use('/api/super-admin', superAdminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
