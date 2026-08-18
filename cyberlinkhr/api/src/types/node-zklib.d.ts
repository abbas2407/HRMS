declare module 'node-zklib' {
  class ZKLib {
    constructor(ip: string, port?: number, timeout?: number, inmemory?: number);
    createSocket(): Promise<void>;
    disconnect(): Promise<void>;
    getAttendances(): Promise<{ data: Array<{ deviceUserId: string | number; recordTime: string; type: number }> }>;
    getUsers(): Promise<{ data: Array<{ uid: number; userId: string | number; name: string; role: number; password: string }> }>;
    getInfo(): Promise<any>;
  }
  export default ZKLib;
}
