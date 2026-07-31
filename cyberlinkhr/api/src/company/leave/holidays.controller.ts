import { Request, Response } from 'express';
import { holidays } from '../../shared/db/tenant.schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
  type: z.enum(['NATIONAL', 'COMPANY', 'OPTIONAL']).default('NATIONAL'),
  state: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

export async function listHolidays(req: Request, res: Response) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const data = await req.runInTenant!(async (db) =>
    db.select().from(holidays)
      .where(and(gte(holidays.date, from), lte(holidays.date, to), eq(holidays.isActive, true)))
      .orderBy(holidays.date)
  );
  return res.json({ data });
}

export async function createHoliday(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(holidays).values(parsed.data).returning()
  );
  return res.status(201).json({ data: row });
}

export async function bulkCreateHolidays(req: Request, res: Response) {
  const list = z.array(schema).safeParse(req.body.holidays);
  if (!list.success) return res.status(400).json({ error: 'Invalid input' });

  const rows = await req.runInTenant!(async (db) =>
    db.insert(holidays).values(list.data).returning()
  );
  return res.status(201).json({ data: rows });
}

export async function updateHoliday(req: Request, res: Response) {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const id = String(req.params.id);

  const [row] = await req.runInTenant!(async (db) =>
    db.update(holidays).set(parsed.data).where(eq(holidays.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Holiday not found' });
  return res.json({ data: row });
}

export async function deleteHoliday(req: Request, res: Response) {
  const id = String(req.params.id);
  await req.runInTenant!(async (db) =>
    db.update(holidays).set({ isActive: false }).where(eq(holidays.id, id))
  );
  return res.json({ data: { message: 'Holiday removed' } });
}

// National holidays list for India (seeded on demand)
export async function seedNationalHolidays(req: Request, res: Response) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const national = [
    { date: `${year}-01-26`, name: 'Republic Day' },
    { date: `${year}-08-15`, name: 'Independence Day' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
  ];
  const rows = await req.runInTenant!(async (db) =>
    db.insert(holidays).values(
      national.map(h => ({ ...h, type: 'NATIONAL' as const, isActive: true }))
    ).onConflictDoNothing().returning()
  );
  return res.json({ data: rows });
}
