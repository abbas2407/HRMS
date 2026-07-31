import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000', {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(schemaName: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.emit('join-tenant', schemaName);
    s.on('connect', () => s.emit('join-tenant', schemaName));
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
