import cron from 'node-cron';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import { runInTenantSchema } from '../db/tenant-db';
import { employees, attendanceLogs } from '../db/tenant.schema';
import { eq, and, sql } from 'drizzle-orm';

export function startAutoAbsent() {
  // Runs at 23:30 daily
  cron.schedule('30 23 * * *', async () => {
    console.log('[CRON] Running auto-absent marking...');
    const today = new Date().toISOString().split('T')[0];

    try {
      const allTenants = await db
        .select({ schemaName: tenants.schemaName, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.status, 'ACTIVE'));

      for (const tenant of allTenants) {
        try {
          await runInTenantSchema(tenant.schemaName, async (tdb) => {
            // Find ACTIVE employees with no attendance record today
            const allActive = await tdb
              .select({ id: employees.id })
              .from(employees)
              .where(eq(employees.status, 'ACTIVE'));

            const todayLogs = await tdb
              .select({ employeeId: attendanceLogs.employeeId })
              .from(attendanceLogs)
              .where(eq(attendanceLogs.date, today));

            const loggedIds = new Set(todayLogs.map(l => l.employeeId));
            const absentIds = allActive.filter(e => !loggedIds.has(e.id)).map(e => e.id);

            if (absentIds.length > 0) {
              await tdb.insert(attendanceLogs).values(
                absentIds.map(id => ({
                  employeeId: id,
                  date: today,
                  status: 'ABSENT' as const,
                  source: 'MANUAL' as const,
                }))
              );
              console.log(`[AUTO-ABSENT] ${tenant.name}: marked ${absentIds.length} employees absent`);
            }

            // Close open punch-ins (employee forgot to punch out)
            const openPunches = todayLogs.filter(l => !loggedIds.has(l.employeeId));
            // Already handled by the absent list; those with punchIn but no punchOut are untouched (HR regularises)
          });
        } catch (err) {
          console.error(`[AUTO-ABSENT] Error for ${tenant.schemaName}:`, err);
        }
      }
    } catch (err) {
      console.error('[AUTO-ABSENT] Cron failed:', err);
    }
  });

  console.log('[CRON] Auto-absent marking scheduled (daily 23:30)');
}
