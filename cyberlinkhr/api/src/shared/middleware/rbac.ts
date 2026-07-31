import { Request, Response, NextFunction } from 'express';

type Role = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role as Role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireHRAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole('HR_ADMIN')(req, res, next);
}

export function requireManagerOrAbove(req: Request, res: Response, next: NextFunction) {
  return requireRole('HR_ADMIN', 'MANAGER')(req, res, next);
}
