import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
const joinedConsultationRooms = new Set<string>();
const reconnectAttempts = { count: 0, maxAttempts: 5 };

const SOCKET_URL = String(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '').trim();
const shouldUseRelativeSocketUrl = (() => {
  if (!SOCKET_URL) return true;
  try {
    const { hostname } = new URL(SOCKET_URL);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
})();

const SOCKET_ENDPOINT = shouldUseRelativeSocketUrl ? '/' : SOCKET_URL;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_ENDPOINT, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      maxReconnectionAttempts: 5
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected');
      reconnectAttempts.count = 0;
      // Rejoin all previously joined rooms
      joinedConsultationRooms.forEach((consultationId) => {
        socketInstance?.emit('join_consultation', consultationId);
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, manual reconnection needed
        socketInstance?.connect();
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reconnectAttempts.count++;
      if (reconnectAttempts.count >= reconnectAttempts.maxAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Socket reconnection failed:', error);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Socket reconnection failed permanently');
    });
  }

  return socketInstance;
};

export const joinConsultationRoom = (consultationId: string): void => {
  if (!consultationId) return;
  joinedConsultationRooms.add(consultationId);
  const socket = getSocket();
  if (socket.connected) {
    socket.emit('join_consultation', consultationId);
  }
};

export const leaveConsultationRoom = (consultationId: string): void => {
  if (!consultationId) return;
  joinedConsultationRooms.delete(consultationId);
  const socket = getSocket();
  if (socket.connected) {
    socket.emit('leave_consultation', consultationId);
  }
};

export const disconnectSocket = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    joinedConsultationRooms.clear();
    reconnectAttempts.count = 0;
  }
};
