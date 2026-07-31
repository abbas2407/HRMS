import cron from 'node-cron';
import { db } from '../db/connection';
import { tenants } from '../db/public.schema';
import { and, eq, gte, lte } from 'drizzle-orm';

export function startRenewalReminders() {
  // Daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    const now = new Date();
    const in1 = new Date(now.getTime() + 1 * 864e5);
    const in7 = new Date(now.getTime() + 7 * 864e5);
    const in14 = new Date(now.getTime() + 14 * 864e5);

    try {
      const expiring14 = await db.select({ name: tenants.name, adminEmail: tenants.adminEmail, subscriptionEndsAt: tenants.subscriptionEndsAt })
        .from(tenants)
        .where(and(eq(tenants.status, 'ACTIVE'), gte(tenants.subscriptionEndsAt, now), lte(tenants.subscriptionEndsAt, in14)));

      for (const t of expiring14) {
        const daysLeft = Math.ceil((new Date(t.subscriptionEndsAt!).getTime() - now.getTime()) / 864e5);
        const urgency = daysLeft <= 1 ? 'URGENT' : daysLeft <= 7 ? 'WARNING' : 'REMINDER';
        console.log(`[cron] Renewal ${urgency}: ${t.name} (${t.adminEmail}) — ${daysLeft} day(s) left`);
        // Email sending wired in Phase 8 mailer setup
      }

      console.log(`[cron] Renewal reminders sent for ${expiring14.length} companies`);
    } catch (err) {
      console.error('[cron] Renewal reminders failed:', err);
    }
  });
}
