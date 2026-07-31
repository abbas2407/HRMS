import { Request, Response } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { grievances, grievanceComments, employees, users } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const grievanceSchema = z.object({
  category: z.enum(['HARASSMENT', 'DISCRIMINATION', 'WORKPLACE_SAFETY', 'SALARY', 'MANAGEMENT', 'POLICY', 'OTHER']),
  subject: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

export async function listGrievances(req: Request, res: Response) {
  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: grievances.id,
      category: grievances.category,
      subject: grievances.subject,
      priority: grievances.priority,
      status: grievances.status,
      employeeId: grievances.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      assignedTo: grievances.assignedTo,
      createdAt: grievances.createdAt,
      updatedAt: grievances.updatedAt,
    })
      .from(grievances)
      .innerJoin(employees, eq(grievances.employeeId, employees.id))
      .where(isAdmin ? sql`1=1` : eq(grievances.employeeId, empId!))
      .orderBy(desc(grievances.createdAt))
  );
  return res.json({ data: rows });
}

export async function getGrievance(req: Request, res: Response) {
  const { id } = req.params;
  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  const [g] = await req.runInTenant!(async (db) =>
    db.select({
      id: grievances.id,
      category: grievances.category,
      subject: grievances.subject,
      description: grievances.description,
      priority: grievances.priority,
      status: grievances.status,
      employeeId: grievances.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      assignedTo: grievances.assignedTo,
      resolution: grievances.resolution,
      resolvedAt: grievances.resolvedAt,
      createdAt: grievances.createdAt,
      updatedAt: grievances.updatedAt,
    })
      .from(grievances)
      .innerJoin(employees, eq(grievances.employeeId, employees.id))
      .where(eq(grievances.id, id))
  );
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && g.employeeId !== empId) return res.status(403).json({ error: 'Forbidden' });

  const comments = await req.runInTenant!(async (db) =>
    db.select({
      id: grievanceComments.id,
      comment: grievanceComments.comment,
      isInternal: grievanceComments.isInternal,
      createdAt: grievanceComments.createdAt,
      authorName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
    })
      .from(grievanceComments)
      .leftJoin(users, eq(grievanceComments.authorId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(grievanceComments.grievanceId, id))
      .orderBy(grievanceComments.createdAt)
  );

  // Hide internal comments from non-admins
  const filteredComments = isAdmin ? comments : comments.filter(c => !c.isInternal);
  return res.json({ data: { ...g, comments: filteredComments } });
}

export async function createGrievance(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile' });

  const parsed = grievanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { category, subject, description, priority } = parsed.data;

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(grievances).values({
      employeeId: empId,
      category,
      subject,
      description,
      priority,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status, resolution, assignedTo } = req.body;
  const allowed = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updates: any = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (resolution) updates.resolution = resolution;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo || null;
  if (status === 'RESOLVED') updates.resolvedAt = new Date();

  const [row] = await req.runInTenant!(async (db) =>
    db.update(grievances).set(updates).where(eq(grievances.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function addComment(req: Request, res: Response) {
  const { id } = req.params;
  const { comment, isInternal } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });

  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  // Non-admin can only comment on their own grievance
  if (!isAdmin) {
    const [g] = await req.runInTenant!(async (db) =>
      db.select({ employeeId: grievances.employeeId })
        .from(grievances).where(eq(grievances.id, id))
    );
    if (!g || g.employeeId !== empId) return res.status(403).json({ error: 'Forbidden' });
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(grievanceComments).values({
      grievanceId: id,
      authorId: req.user!.userId,
      comment,
      isInternal: isAdmin && !!isInternal,
    }).returning()
  );
  return res.status(201).json({ data: row });
}
