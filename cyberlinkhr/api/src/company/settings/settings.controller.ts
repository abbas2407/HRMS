import { Request, Response } from 'express';
import { companySettings } from '../../shared/db/tenant.schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ALLOWED_KEYS = new Set([
  'company_name', 'company_logo_url', 'state', 'timezone', 'currency',
  'week_off_days', 'financial_year_start', 'payroll_cutoff_day',
  'probation_days', 'notice_period_days', 'pan_number', 'tan_number',
  'pf_number', 'esic_number', 'pt_number',
]);

export async function getSettings(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select().from(companySettings)
  );
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value || '';
  return res.json({ data: settings });
}

export async function upsertSetting(req: Request, res: Response) {
  const parsed = z.object({ key: z.string(), value: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide key and value' });
  const { key, value } = parsed.data;
  if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: `Unknown setting key: ${key}` });

  const existing = await req.runInTenant!(async (db) =>
    db.select().from(companySettings).where(eq(companySettings.key, key)).limit(1)
  );
  if (existing.length > 0) {
    await req.runInTenant!(async (db) =>
      db.update(companySettings).set({ value, updatedAt: new Date() }).where(eq(companySettings.key, key))
    );
  } else {
    await req.runInTenant!(async (db) =>
      db.insert(companySettings).values({ key, value })
    );
  }
  return res.json({ data: { key, value } });
}

export async function bulkUpsertSettings(req: Request, res: Response) {
  const parsed = z.record(z.string()).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a key-value object' });

  const invalid = Object.keys(parsed.data).filter(k => !ALLOWED_KEYS.has(k));
  if (invalid.length) return res.status(400).json({ error: `Unknown keys: ${invalid.join(', ')}` });

  for (const [key, value] of Object.entries(parsed.data)) {
    const existing = await req.runInTenant!(async (db) =>
      db.select({ id: companySettings.id }).from(companySettings).where(eq(companySettings.key, key)).limit(1)
    );
    if (existing.length > 0) {
      await req.runInTenant!(async (db) =>
        db.update(companySettings).set({ value, updatedAt: new Date() }).where(eq(companySettings.key, key))
      );
    } else {
      await req.runInTenant!(async (db) =>
        db.insert(companySettings).values({ key, value })
      );
    }
  }
  return res.json({ data: parsed.data });
}
