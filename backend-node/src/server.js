import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { connectToDatabase } from './config/db.js';
import { env } from './config/env.js';
import { setSocketServer } from './socket.js';

dotenv.config();

// Disable SSL certificate verification for development
// This is needed for MongoDB Atlas and external API calls in dev environment
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // Create custom agents with SSL certificate verification disabled
  const httpsAgent = new HttpsAgent({
    rejectUnauthorized: false,
    minVersion: 'TLSv1'
  });
  
  const httpAgent = new HttpAgent({
    keepAlive: true
  });
  
  // Set global agents
  https.globalAgent = httpsAgent;
  http.globalAgent = httpAgent;
}

const PORT = env.PORT || 5000;

const startServer = async () => {
  try {
    await connectToDatabase();

    const app = createApp();
    const server = http.createServer(app);

    const io = new SocketIOServer(server, {
      cors: {
        origin: env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    setSocketServer(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Frontend URL: ${env.FRONTEND_URL || "http://localhost:3000"}`);
      console.log(`🔗 Socket.IO enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
