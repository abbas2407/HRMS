import { Server } from 'socket.io';

let _io: Server | null = null;

export function setIO(io: Server) {
  _io = io;
}

export function getIO(): Server | null {
  return _io;
}

export function emitToTenant(schemaName: string, event: string, data: unknown) {
  _io?.to(`tenant:${schemaName}`).emit(event, data);
}
