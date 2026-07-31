import cron from 'node-cron';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import { and, eq, lt } from 'drizzle-orm';

export function startExpiryCheck() {
  // Daily at midnight
  cron.schedule('0 0 * * *', async () => {
    const now = new Date();
    try {
      // Trial expired
      await db.update(tenants)
        .set({ status: 'TRIAL_EXPIRED' })
        .where(and(eq(tenants.status, 'TRIAL'), lt(tenants.trialEndsAt, now)));

      // Subscription expired
      await db.update(tenants)
        .set({ status: 'EXPIRED' })
        .where(and(eq(tenants.status, 'ACTIVE'), lt(tenants.subscriptionEndsAt, now)));

      console.log('[cron] Expiry check complete');
    } catch (err) {
      console.error('[cron] Expiry check failed:', err);
    }
  });
}
