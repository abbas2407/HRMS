import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyVendorToken, JwtPayload, VendorJwtPayload } from '../utils/jwt';
import { isTokenBlacklisted } from '../utils/redis';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      vendorUser?: VendorJwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function authenticateVendor(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);

  try {
    req.vendorUser = verifyVendorToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired vendor token' });
  }
}
