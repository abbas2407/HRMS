import cron from 'node-cron';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import { runInTenantSchema } from '../db/tenant-db';
import { eq } from 'drizzle-orm';
import { runAccrual } from '../../company/leave/leave-balance.controller';

export function startLeaveAccrual() {
  // Runs at 00:05 on the 1st of every month
  cron.schedule('5 0 1 * *', async () => {
    console.log('[CRON] Running monthly leave accrual...');
    try {
      const allTenants = await db
        .select({ schemaName: tenants.schemaName, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.status, 'ACTIVE'));

      for (const tenant of allTenants) {
        try {
          await runAccrual((fn) => runInTenantSchema(tenant.schemaName, fn));
          console.log(`[LEAVE-ACCRUAL] ${tenant.name}: done`);
        } catch (err) {
          console.error(`[LEAVE-ACCRUAL] Error for ${tenant.schemaName}:`, err);
        }
      }
    } catch (err) {
      console.error('[LEAVE-ACCRUAL] Cron failed:', err);
    }
  });
  console.log('[CRON] Leave accrual scheduled (1st of month 00:05)');
}
