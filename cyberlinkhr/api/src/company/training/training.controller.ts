import { Request, Response } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { trainingPrograms, trainingEnrollments, employees } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const programSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['TECHNICAL', 'SOFT_SKILLS', 'COMPLIANCE', 'LEADERSHIP', 'OTHER']).default('TECHNICAL'),
  description: z.string().optional(),
  trainer: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
});

export async function listPrograms(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: trainingPrograms.id,
      title: trainingPrograms.title,
      type: trainingPrograms.type,
      description: trainingPrograms.description,
      trainer: trainingPrograms.trainer,
      startDate: trainingPrograms.startDate,
      endDate: trainingPrograms.endDate,
      maxCapacity: trainingPrograms.maxCapacity,
      status: trainingPrograms.status,
      enrollmentCount: sql<number>`(
        SELECT COUNT(*) FROM ${trainingEnrollments}
        WHERE ${trainingEnrollments.programId} = ${trainingPrograms.id}
        AND ${trainingEnrollments.status} != 'DROPPED'
      )`,
      createdAt: trainingPrograms.createdAt,
    })
      .from(trainingPrograms)
      .orderBy(desc(trainingPrograms.createdAt))
  );
  return res.json({ data: rows });
}

export async function createProgram(req: Request, res: Response) {
  const parsed = programSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(trainingPrograms).values({
      title: d.title,
      type: d.type,
      description: d.description,
      trainer: d.trainer,
      startDate: d.startDate,
      endDate: d.endDate,
      maxCapacity: d.maxCapacity,
      createdBy: req.user!.userId,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateProgramStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const [row] = await req.runInTenant!(async (db) =>
    db.update(trainingPrograms).set({ status, updatedAt: new Date() })
      .where(eq(trainingPrograms.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function enrollEmployee(req: Request, res: Response) {
  const { id } = req.params;
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ error: 'employeeId required' });

  const [prog] = await req.runInTenant!(async (db) =>
    db.select({ maxCapacity: trainingPrograms.maxCapacity })
      .from(trainingPrograms).where(eq(trainingPrograms.id, id))
  );
  if (!prog) return res.status(404).json({ error: 'Program not found' });

  if (prog.maxCapacity) {
    const [{ cnt }] = await req.runInTenant!(async (db) =>
      db.select({ cnt: sql<number>`count(*)` }).from(trainingEnrollments)
        .where(and(eq(trainingEnrollments.programId, id), eq(trainingEnrollments.status, 'ENROLLED')))
    );
    if (Number(cnt) >= prog.maxCapacity) {
      return res.status(400).json({ error: 'Training is at full capacity' });
    }
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(trainingEnrollments).values({
      programId: id,
      employeeId,
      enrolledBy: req.user!.userId,
    }).onConflictDoNothing().returning()
  );
  return res.status(201).json({ data: row });
}

export async function markComplete(req: Request, res: Response) {
  const { enrollmentId } = req.params;
  const [row] = await req.runInTenant!(async (db) =>
    db.update(trainingEnrollments).set({
      status: 'COMPLETED',
      completedAt: new Date(),
    }).where(eq(trainingEnrollments.id, enrollmentId)).returning()
  );
  return res.json({ data: row });
}

export async function listEnrollments(req: Request, res: Response) {
  const { programId } = req.params;
  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: trainingEnrollments.id,
      employeeId: trainingEnrollments.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeCode: employees.employeeCode,
      status: trainingEnrollments.status,
      enrolledAt: trainingEnrollments.enrolledAt,
      completedAt: trainingEnrollments.completedAt,
    })
      .from(trainingEnrollments)
      .innerJoin(employees, eq(trainingEnrollments.employeeId, employees.id))
      .where(eq(trainingEnrollments.programId, programId))
      .orderBy(employees.firstName)
  );
  return res.json({ data: rows });
}

export async function getMyTrainings(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.json({ data: [] });

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: trainingEnrollments.id,
      programId: trainingPrograms.id,
      title: trainingPrograms.title,
      type: trainingPrograms.type,
      trainer: trainingPrograms.trainer,
      startDate: trainingPrograms.startDate,
      endDate: trainingPrograms.endDate,
      programStatus: trainingPrograms.status,
      enrollmentStatus: trainingEnrollments.status,
      enrolledAt: trainingEnrollments.enrolledAt,
      completedAt: trainingEnrollments.completedAt,
    })
      .from(trainingEnrollments)
      .innerJoin(trainingPrograms, eq(trainingEnrollments.programId, trainingPrograms.id))
      .where(eq(trainingEnrollments.employeeId, empId))
      .orderBy(desc(trainingEnrollments.enrolledAt))
  );
  return res.json({ data: rows });
}
