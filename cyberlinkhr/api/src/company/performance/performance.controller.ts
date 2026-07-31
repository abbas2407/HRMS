import { Request, Response } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { appraisalCycles, appraisalSubmissions, employees } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const cycleSchema = z.object({
  name: z.string().min(1).max(200),
  period: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
});

export async function listCycles(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select().from(appraisalCycles).orderBy(desc(appraisalCycles.createdAt))
  );
  return res.json({ data: rows });
}

export async function createCycle(req: Request, res: Response) {
  const parsed = cycleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, period, startDate, endDate } = parsed.data;

  const [cycle] = await req.runInTenant!(async (db) =>
    db.insert(appraisalCycles).values({
      name, period, startDate, endDate,
      createdBy: req.user!.userId,
    }).returning()
  );

  // Auto-create pending submissions for all active employees
  const emps = await req.runInTenant!(async (db) =>
    db.select({ id: employees.id })
      .from(employees)
      .where(eq(employees.status, 'ACTIVE'))
  );

  if (emps.length > 0) {
    await req.runInTenant!(async (db) =>
      db.insert(appraisalSubmissions).values(
        emps.map(e => ({
          cycleId: cycle.id,
          employeeId: e.id,
          goals: [],
          status: 'PENDING',
        }))
      ).onConflictDoNothing()
    );
  }

  return res.status(201).json({ data: cycle });
}

export async function closeCycle(req: Request, res: Response) {
  const { id } = req.params;
  const [row] = await req.runInTenant!(async (db) =>
    db.update(appraisalCycles)
      .set({ status: 'CLOSED' })
      .where(eq(appraisalCycles.id, id))
      .returning()
  );
  return res.json({ data: row });
}

export async function listSubmissions(req: Request, res: Response) {
  const { cycleId } = req.query;
  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: appraisalSubmissions.id,
      cycleId: appraisalSubmissions.cycleId,
      employeeId: appraisalSubmissions.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeCode: employees.employeeCode,
      goals: appraisalSubmissions.goals,
      selfRating: appraisalSubmissions.selfRating,
      selfComments: appraisalSubmissions.selfComments,
      managerRating: appraisalSubmissions.managerRating,
      managerComments: appraisalSubmissions.managerComments,
      status: appraisalSubmissions.status,
      selfSubmittedAt: appraisalSubmissions.selfSubmittedAt,
      reviewedAt: appraisalSubmissions.reviewedAt,
      updatedAt: appraisalSubmissions.updatedAt,
    })
      .from(appraisalSubmissions)
      .innerJoin(employees, eq(appraisalSubmissions.employeeId, employees.id))
      .where(cycleId ? eq(appraisalSubmissions.cycleId, String(cycleId)) : sql`1=1`)
      .orderBy(employees.firstName)
  );
  return res.json({ data: rows });
}

export async function getMySubmission(req: Request, res: Response) {
  const { cycleId } = req.params;
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile linked' });

  const [row] = await req.runInTenant!(async (db) =>
    db.select().from(appraisalSubmissions)
      .where(and(
        eq(appraisalSubmissions.cycleId, cycleId),
        eq(appraisalSubmissions.employeeId, empId)
      ))
  );
  return res.json({ data: row || null });
}

export async function submitSelf(req: Request, res: Response) {
  const { id } = req.params;
  const { goals, selfRating, selfComments } = req.body;

  if (!selfRating || selfRating < 1 || selfRating > 5) {
    return res.status(400).json({ error: 'Self rating must be 1–5' });
  }

  const [sub] = await req.runInTenant!(async (db) =>
    db.select({ employeeId: appraisalSubmissions.employeeId })
      .from(appraisalSubmissions)
      .where(eq(appraisalSubmissions.id, id))
  );
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  if (sub.employeeId !== req.user?.employeeId && req.user?.role !== 'HR_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.update(appraisalSubmissions).set({
      goals: goals || [],
      selfRating,
      selfComments,
      status: 'SELF_SUBMITTED',
      selfSubmittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(appraisalSubmissions.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function submitManagerReview(req: Request, res: Response) {
  const { id } = req.params;
  const { managerRating, managerComments } = req.body;

  if (!managerRating || managerRating < 1 || managerRating > 5) {
    return res.status(400).json({ error: 'Manager rating must be 1–5' });
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.update(appraisalSubmissions).set({
      managerRating,
      managerComments,
      status: 'MANAGER_REVIEWED',
      reviewedAt: new Date(),
      reviewedBy: req.user!.userId,
      updatedAt: new Date(),
    }).where(eq(appraisalSubmissions.id, id)).returning()
  );
  return res.json({ data: row });
}
