import cron from 'node-cron';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import { runInTenantSchema } from '../db/tenant-db';
import { documents, employees } from '../db/tenant.schema';
import { eq, and, lte, gte, sql } from 'drizzle-orm';

export function startExpiryAlerts() {
  // Daily at 08:00 — log documents expiring within 30 days
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running document expiry check...');
    try {
      const allTenants = await db
        .select({ id: tenants.id, schemaName: tenants.schemaName, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.status, 'ACTIVE'));

      for (const tenant of allTenants) {
        try {
          const now = new Date();
          const in30 = new Date(Date.now() + 30 * 86_400_000);

          const expiring = await runInTenantSchema(tenant.schemaName, async (tdb) =>
            tdb
              .select({
                docType: documents.docType,
                expiryDate: documents.expiryDate,
                employeeId: documents.employeeId,
                employeeName: sql<string>`(SELECT first_name || ' ' || last_name FROM employees WHERE id = documents.employee_id)`,
              })
              .from(documents)
              .where(and(
                eq(documents.isDeleted, false),
                lte(documents.expiryDate, in30.toISOString().split('T')[0]),
                gte(documents.expiryDate, now.toISOString().split('T')[0]),
              ))
          );

          if (expiring.length > 0) {
            console.log(`[EXPIRY] ${tenant.name}: ${expiring.length} document(s) expiring in 30 days`);
            expiring.forEach(d => {
              const daysLeft = Math.ceil((new Date(d.expiryDate!).getTime() - Date.now()) / 86_400_000);
              console.log(`  → ${d.employeeName} — ${d.docType} expires in ${daysLeft}d (${d.expiryDate})`);
            });
          }
        } catch (err) {
          console.error(`[EXPIRY] Error for tenant ${tenant.schemaName}:`, err);
        }
      }
    } catch (err) {
      console.error('[EXPIRY] Cron failed:', err);
    }
  });

  console.log('[CRON] Document expiry alerts scheduled (daily 08:00)');
}
