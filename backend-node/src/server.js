import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { connectToDatabase } from './config/db.js';
import { env } from './config/env.js';

const bootstrap = async () => {
  await connectToDatabase();
  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: { origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()), credentials: true }
  });

  io.on('connection', (socket) => {
    socket.emit('connected', { message: 'Connected to Clinix.ai socket server' });
    socket.on('join_consultation', (roomId) => socket.join(`consultation:${roomId}`));
    socket.on('disconnect', () => undefined);
  });

  server.listen(env.PORT, () => {
    console.log(`Clinix.ai Node API listening on port ${env.PORT}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
