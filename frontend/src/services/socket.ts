import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
  }

  return socketInstance;
};

export const joinConsultationRoom = (consultationId: string): void => {
  if (!consultationId) return;
  getSocket().emit('join_consultation', consultationId);
};
