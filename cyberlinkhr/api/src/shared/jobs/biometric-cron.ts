import cron from 'node-cron';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import { runInTenantSchema } from '../db/tenant-db';
import { biometricDevices } from '../db/tenant.schema';
import { syncDevice } from '../../company/biometric/biometric-sync.service';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

export function startBiometricSync() {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[CRON] Running biometric device auto-sync...');
    try {
      const activeTenants = await db
        .select({ schemaName: tenants.schemaName, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.status, 'ACTIVE'));

      for (const tenant of activeTenants) {
        try {
          await runInTenantSchema(tenant.schemaName, async (tdb) => {
            const devices = await tdb
              .select()
              .from(biometricDevices)
              .where(eq(biometricDevices.isActive, true));

            for (const device of devices) {
              const runInTenant = (fn: any) => runInTenantSchema(tenant.schemaName, fn);
              await syncDevice(runInTenant, device);
            }
          });
        } catch (err: any) {
          logger.error(`[CRON] Biometric sync error for tenant ${tenant.name}: ${err?.message || err}`);
        }
      }
    } catch (err: any) {
      logger.error(`[CRON] Biometric sync main error: ${err?.message || err}`);
    }
  });
}
