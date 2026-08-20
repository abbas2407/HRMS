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

// Full Indian national + major international holidays
function buildNationalHolidays(year: number) {
  return [
    // Indian National / Gazetted
    { date: `${year}-01-01`, name: 'New Year\'s Day',          type: 'OPTIONAL' as const },
    { date: `${year}-01-14`, name: 'Makar Sankranti / Pongal', type: 'NATIONAL' as const },
    { date: `${year}-01-26`, name: 'Republic Day',             type: 'NATIONAL' as const },
    { date: `${year}-02-19`, name: 'Chhatrapati Shivaji Jayanti', type: 'NATIONAL' as const },
    { date: `${year}-03-08`, name: 'International Women\'s Day', type: 'OPTIONAL' as const },
    { date: `${year}-04-14`, name: 'Ambedkar Jayanti / Tamil New Year', type: 'NATIONAL' as const },
    { date: `${year}-04-18`, name: 'Good Friday',              type: 'NATIONAL' as const },
    { date: `${year}-04-21`, name: 'Easter Monday',            type: 'OPTIONAL' as const },
    { date: `${year}-05-01`, name: 'Maharashtra Day / Labour Day', type: 'NATIONAL' as const },
    { date: `${year}-08-15`, name: 'Independence Day',         type: 'NATIONAL' as const },
    { date: `${year}-08-27`, name: 'Janmashtami',              type: 'NATIONAL' as const },
    { date: `${year}-09-05`, name: 'Teachers\' Day',           type: 'OPTIONAL' as const },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti',           type: 'NATIONAL' as const },
    { date: `${year}-10-02`, name: 'Dussehra (Vijayadashami)', type: 'NATIONAL' as const },
    { date: `${year}-10-20`, name: 'Diwali (Lakshmi Puja)',    type: 'NATIONAL' as const },
    { date: `${year}-10-21`, name: 'Diwali (Bali Pratipada)',  type: 'NATIONAL' as const },
    { date: `${year}-11-05`, name: 'Guru Nanak Jayanti',       type: 'NATIONAL' as const },
    { date: `${year}-11-14`, name: 'Children\'s Day',          type: 'OPTIONAL' as const },
    { date: `${year}-12-25`, name: 'Christmas Day',            type: 'NATIONAL' as const },
    // Variable / approximate dates (admins can adjust)
    { date: `${year}-03-14`, name: 'Holi',                     type: 'NATIONAL' as const },
    { date: `${year}-03-30`, name: 'Ram Navami',               type: 'NATIONAL' as const },
    { date: `${year}-03-31`, name: 'Id-ul-Fitr (Eid)',         type: 'NATIONAL' as const },
    { date: `${year}-06-07`, name: 'Eid-ul-Adha (Bakrid)',     type: 'NATIONAL' as const },
    { date: `${year}-07-06`, name: 'Muharram',                 type: 'NATIONAL' as const },
    { date: `${year}-09-16`, name: 'Milad-un-Nabi (Prophet\'s Birthday)', type: 'NATIONAL' as const },
  ].map(h => ({ ...h, isActive: true }));
}

export async function seedNationalHolidays(req: Request, res: Response) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const national = buildNationalHolidays(year);

  const rows = await req.runInTenant!(async (db) =>
    db.insert(holidays).values(national).onConflictDoNothing().returning()
  );
  return res.json({ data: rows, seeded: rows.length });
}
