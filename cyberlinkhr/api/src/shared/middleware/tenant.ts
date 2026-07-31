import { Request, Response, NextFunction } from 'express';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import * as tenantSchema from '../db/tenant.schema';
import { eq } from 'drizzle-orm';
import { getTenantDB, runInTenantSchema } from '../db/tenant-db';

type TenantFn<T> = (db: NodePgDatabase<typeof tenantSchema>) => Promise<T>;

declare global {
  namespace Express {
    interface Request {
      tenant?: typeof tenants.$inferSelect;
      tenantDB?: ReturnType<typeof getTenantDB>;
      runInTenant?: <T>(fn: TenantFn<T>) => Promise<T>;
    }
  }
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.tenantId) {
    return res.status(401).json({ error: 'No tenant in token' });
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, user.tenantId))
    .limit(1);

  if (!tenant) {
    return res.status(404).json({ error: 'Company not found' });
  }

  if (tenant.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Account suspended. Contact support.' });
  }

  if (tenant.status === 'CANCELLED') {
    return res.status(403).json({ error: 'Account cancelled.' });
  }

  if (tenant.status === 'EXPIRED' || tenant.status === 'TRIAL_EXPIRED') {
    if (req.method !== 'GET') {
      return res.status(402).json({
        error: 'Subscription expired. Please renew to continue.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }
  }

  req.tenant = tenant;
  req.runInTenant = <T>(fn: TenantFn<T>) => runInTenantSchema<T>(tenant.schemaName, fn);

  next();
}
