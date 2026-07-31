import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let privateKey: string;
let publicKey: string;

function loadKeys() {
  if (!privateKey) {
    privateKey = fs.readFileSync(
      path.resolve(process.env.JWT_PRIVATE_KEY_PATH || './keys/private.pem'),
      'utf8'
    );
    publicKey = fs.readFileSync(
      path.resolve(process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem'),
      'utf8'
    );
  }
}

export interface JwtPayload {
  userId: string;
  employeeId?: string;
  role: string;
  tenantId: string;
  schemaName: string;
  email: string;
}

export interface VendorJwtPayload {
  vendorUserId: string;
  email: string;
  type: 'vendor';
}

export function signAccessToken(payload: JwtPayload): string {
  loadKeys();
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as any,
  });
}

export function signRefreshToken(userId: string): string {
  const token = crypto.randomBytes(64).toString('hex');
  return token;
}

export function verifyAccessToken(token: string): JwtPayload {
  loadKeys();
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as JwtPayload;
}

export function signVendorToken(payload: VendorJwtPayload): string {
  const secret = process.env.VENDOR_JWT_SECRET!;
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

export function verifyVendorToken(token: string): VendorJwtPayload {
  const secret = process.env.VENDOR_JWT_SECRET!;
  return jwt.verify(token, secret) as VendorJwtPayload;
}

export function signImpersonateToken(payload: JwtPayload): string {
  loadKeys();
  return jwt.sign({ ...payload, impersonated: true }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '1h',
  });
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
