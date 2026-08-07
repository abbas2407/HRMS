import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000', {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function connectSocket(schemaName: string, token: string): Socket {
  const s = getSocket(token);
  if (!s.connected) {
    // Ensure auth token is set before connecting
    s.auth = { token };
    s.connect();
    s.emit('join-tenant', schemaName);
    s.on('connect', () => s.emit('join-tenant', schemaName));
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null; // allow re-creation with fresh token on next login
}
