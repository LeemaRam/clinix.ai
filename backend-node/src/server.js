import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import http from 'http';
import bcrypt from 'bcryptjs';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { connectToDatabase } from './config/db.js';
import { env } from './config/env.js';
import { setSocketServer } from './socket.js';
import { resumePendingAiTasks } from './services/aiTaskService.js';
import { validateTwilioConfig } from './services/twilioService.js';
import { User } from './models/User.js';

dotenv.config();

const PORT = env.PORT || 5000;
let server;
let io;

const parseAllowedOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const ensureUploadDirectories = () => {
  const directories = [env.UPLOAD_AUDIO_DIR, env.UPLOAD_REPORTS_DIR, env.UPLOAD_PATIENT_FILES_DIR];

  directories.forEach((dir) => {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
      console.log(`📁 Created upload directory: ${resolved}`);
    }
  });
};

const ensureSuperAdminAccount = async () => {
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) {
    return;
  }

  const normalizedEmail = env.SUPER_ADMIN_EMAIL.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 10);

  if (existingUser) {
    let shouldSave = false;
    if (existingUser.role !== 'super_admin') {
      existingUser.role = 'super_admin';
      shouldSave = true;
    }

    const passwordMatches = existingUser.passwordHash
      ? await bcrypt.compare(env.SUPER_ADMIN_PASSWORD, existingUser.passwordHash)
      : false;

    if (!passwordMatches) {
      existingUser.passwordHash = passwordHash;
      shouldSave = true;
    }

    if (shouldSave) {
      await existingUser.save();
      console.log(`🔐 Updated existing super admin account: ${normalizedEmail}`);
    } else {
      console.log(`🔐 Super admin account already exists and is up to date: ${normalizedEmail}`);
    }
    return;
  }

  await User.create({
    fullName: env.SUPER_ADMIN_FULL_NAME,
    email: normalizedEmail,
    passwordHash,
    role: 'super_admin'
  });

  console.log(`🔐 Created super admin account: ${normalizedEmail}`);
};

const startServer = async () => {
  try {
    console.log(`🚀 Starting ${env.NODE_ENV} server...`);

    // Validate Twilio configuration
    validateTwilioConfig();

    await connectToDatabase();
    await ensureSuperAdminAccount();
    ensureUploadDirectories();

    const app = createApp();
    server = http.createServer(app);

    // Socket.IO configuration: strict origin alignment with FRONTEND_URL only.
    const frontendOrigins = parseAllowedOrigins(env.FRONTEND_URL);
    const socketCorsOrigin = env.NODE_ENV === 'production'
      ? frontendOrigins
      : (frontendOrigins[0] || 'http://localhost:3000');

    io = new SocketIOServer(server, {
      cors: {
        origin: socketCorsOrigin,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 20000,
      maxHttpBufferSize: 1e8, // 100MB for file uploads
      allowEIO3: true // Allow Engine.IO v3 clients
    });

    setSocketServer(io);

    io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      socket.on('join_consultation', (consultationId) => {
        if (!consultationId) return;
        socket.join(`consultation:${consultationId}`);
        console.log(`📱 Socket ${socket.id} joined consultation: ${consultationId}`);
      });

      socket.on('leave_consultation', (consultationId) => {
        if (!consultationId) return;
        socket.leave(`consultation:${consultationId}`);
        console.log(`📱 Socket ${socket.id} left consultation: ${consultationId}`);
      });

      socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket disconnected: ${socket.id}, reason: ${reason}`);
      });
    });

    // Resume any pending AI tasks
    await resumePendingAiTasks();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Socket.IO enabled with CORS: ${JSON.stringify(socketCorsOrigin)}`);
      if (env.FRONTEND_URL) {
        console.log(`📱 Frontend URL: ${env.FRONTEND_URL}`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close((err) => {
      if (err) {
        console.error('❌ Error during server shutdown:', err);
        process.exit(1);
      }

      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  }

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
