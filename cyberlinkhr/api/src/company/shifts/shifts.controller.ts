import { Request, Response } from 'express';
import { shifts, shiftAssignments, employees } from '../../shared/db/tenant.schema';
import { eq, and, lte, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const shiftSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  graceMinutes: z.number().int().min(0).max(60).default(10),
  isNightShift: z.boolean().default(false),
  weekOffs: z.array(z.number().int().min(0).max(6)).default([0, 6]),
});

export async function listShifts(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select({
      id: shifts.id, name: shifts.name, startTime: shifts.startTime,
      endTime: shifts.endTime, graceMinutes: shifts.graceMinutes,
      isNightShift: shifts.isNightShift, weekOffs: shifts.weekOffs,
      isActive: shifts.isActive, createdAt: shifts.createdAt,
      assignedCount: sql<number>`(SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = shifts.id)`,
    }).from(shifts).orderBy(shifts.name)
  );
  return res.json({ data });
}

export async function createShift(req: Request, res: Response) {
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(shifts).values(parsed.data).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateShift(req: Request, res: Response) {
  const parsed = shiftSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const [row] = await req.runInTenant!(async (db) =>
    db.update(shifts).set(parsed.data).where(eq(shifts.id, String(req.params.id))).returning()
  );
  if (!row) return res.status(404).json({ error: 'Shift not found' });
  return res.json({ data: row });
}

export async function deleteShift(req: Request, res: Response) {
  const id = String(req.params.id);
  await req.runInTenant!(async (db) =>
    db.update(shifts).set({ isActive: false }).where(eq(shifts.id, id))
  );
  return res.json({ data: { message: 'Shift deactivated' } });
}

export async function assignShift(req: Request, res: Response) {
  const { employeeId, effectiveFrom } = req.body;
  if (!employeeId || !effectiveFrom) return res.status(400).json({ error: 'employeeId and effectiveFrom required' });

  const shiftId = String(req.params.id);
  const [row] = await req.runInTenant!(async (db) =>
    db.insert(shiftAssignments).values({ employeeId, shiftId, effectiveFrom }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function getEmployeeShift(req: Request, res: Response) {
  const empId = String(req.params.empId);
  const today = new Date().toISOString().split('T')[0];

  const data = await req.runInTenant!(async (db) => {
    const [assignment] = await db
      .select({ shift: shifts })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .where(and(eq(shiftAssignments.employeeId, empId), lte(shiftAssignments.effectiveFrom, today)))
      .orderBy(desc(shiftAssignments.effectiveFrom))
      .limit(1);
    return assignment?.shift ?? null;
  });

  return res.json({ data });
}
