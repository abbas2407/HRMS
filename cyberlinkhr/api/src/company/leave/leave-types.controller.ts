import { Request, Response } from 'express';
import { leaveTypes } from '../../shared/db/tenant.schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20).toUpperCase(),
  maxDaysPerYear: z.number().int().min(0).optional(),
  minNoticeDays: z.number().int().min(0).default(0),
  accrualPerMonth: z.number().min(0).default(0),
  carryForwardCap: z.number().int().min(0).optional(),
  isPaid: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function listLeaveTypes(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select().from(leaveTypes).orderBy(leaveTypes.name)
  );
  return res.json({ data });
}

export async function createLeaveType(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(leaveTypes).values({
      ...parsed.data,
      accrualPerMonth: String(parsed.data.accrualPerMonth),
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateLeaveType(req: Request, res: Response) {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const id = String(req.params.id);

  const update: any = { ...parsed.data };
  if (parsed.data.accrualPerMonth !== undefined) update.accrualPerMonth = String(parsed.data.accrualPerMonth);

  const [row] = await req.runInTenant!(async (db) =>
    db.update(leaveTypes).set(update).where(eq(leaveTypes.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Leave type not found' });
  return res.json({ data: row });
}

export async function deleteLeaveType(req: Request, res: Response) {
  const id = String(req.params.id);
  await req.runInTenant!(async (db) =>
    db.update(leaveTypes).set({ isActive: false }).where(eq(leaveTypes.id, id))
  );
  return res.json({ data: { message: 'Leave type deactivated' } });
}
