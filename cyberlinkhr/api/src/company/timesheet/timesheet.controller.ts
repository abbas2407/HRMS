import { Request, Response } from 'express';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { projects, timesheetEntries, employees, users } from '../../shared/db/tenant.schema';
import { audit, notify } from '../../shared/utils/notify';
import { z } from 'zod';

function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select().from(projects).orderBy(projects.name)
  );
  return res.json({ data: rows });
}

export async function createProject(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(1).max(200),
    clientName: z.string().max(200).optional(),
    description: z.string().optional(),
    billable: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(projects).values({
      name: parsed.data.name,
      clientName: parsed.data.clientName,
      description: parsed.data.description,
      billable: parsed.data.billable,
      createdBy: req.user!.userId,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateProject(req: Request, res: Response) {
  const { id } = req.params;
  const { name, clientName, description, billable, status } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (name) updates.name = name;
  if (clientName !== undefined) updates.clientName = clientName;
  if (description !== undefined) updates.description = description;
  if (billable !== undefined) updates.billable = billable;
  if (status) updates.status = status;

  const [row] = await req.runInTenant!(async (db) =>
    db.update(projects).set(updates).where(eq(projects.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
}

// ── Timesheet entries ─────────────────────────────────────────────────────────

export async function getMyWeek(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile' });

  const weekStartStr = (req.query.weekStart as string) || toDateStr(getWeekStart(toDateStr(new Date())));
  const ws = new Date(weekStartStr + 'T00:00:00Z');
  const we = new Date(ws);
  we.setUTCDate(we.getUTCDate() + 6);

  const entries = await req.runInTenant!(async (db) =>
    db.select({
      id: timesheetEntries.id,
      projectId: timesheetEntries.projectId,
      projectName: projects.name,
      entryDate: timesheetEntries.entryDate,
      hours: timesheetEntries.hours,
      taskDescription: timesheetEntries.taskDescription,
      billable: timesheetEntries.billable,
      status: timesheetEntries.status,
    })
      .from(timesheetEntries)
      .innerJoin(projects, eq(timesheetEntries.projectId, projects.id))
      .where(and(
        eq(timesheetEntries.employeeId, empId),
        eq(timesheetEntries.weekStart, weekStartStr),
      ))
  );
  return res.json({ data: entries, weekStart: weekStartStr });
}

export async function upsertEntry(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile' });

  const schema = z.object({
    projectId: z.string().uuid(),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hours: z.number().min(0).max(24),
    taskDescription: z.string().max(500).optional(),
    billable: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const weekStartStr = toDateStr(getWeekStart(parsed.data.entryDate));

  // Block edits on submitted/approved entries
  const [existing] = await req.runInTenant!(async (db) =>
    db.select({ id: timesheetEntries.id, status: timesheetEntries.status })
      .from(timesheetEntries)
      .where(and(
        eq(timesheetEntries.employeeId, empId),
        eq(timesheetEntries.projectId, parsed.data.projectId),
        eq(timesheetEntries.entryDate, parsed.data.entryDate),
      ))
  );

  if (existing && ['SUBMITTED', 'APPROVED'].includes(existing.status)) {
    return res.status(400).json({ error: 'Cannot edit a submitted or approved entry' });
  }

  const hoursStr = String(parsed.data.hours);

  if (existing) {
    const [row] = await req.runInTenant!(async (db) =>
      db.update(timesheetEntries).set({
        hours: hoursStr,
        taskDescription: parsed.data.taskDescription,
        billable: parsed.data.billable ?? true,
        updatedAt: new Date(),
      }).where(eq(timesheetEntries.id, existing.id)).returning()
    );
    return res.json({ data: row });
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(timesheetEntries).values({
      employeeId: empId,
      projectId: parsed.data.projectId,
      entryDate: parsed.data.entryDate,
      weekStart: weekStartStr,
      hours: hoursStr,
      taskDescription: parsed.data.taskDescription,
      billable: parsed.data.billable ?? true,
      status: 'DRAFT',
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function submitWeek(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile' });

  const weekStartStr = req.body.weekStart;
  if (!weekStartStr) return res.status(400).json({ error: 'weekStart required' });

  const updated = await req.runInTenant!(async (db) =>
    db.update(timesheetEntries)
      .set({ status: 'SUBMITTED', submittedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(timesheetEntries.employeeId, empId),
        eq(timesheetEntries.weekStart, weekStartStr),
        eq(timesheetEntries.status, 'DRAFT'),
      )).returning()
  );

  if (!updated.length) return res.status(400).json({ error: 'No draft entries to submit for this week' });

  await req.runInTenant!(async (db) => {
    await audit({ db, userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, action: 'timesheet.submitted', entity: 'timesheet_entries', details: `Week ${weekStartStr}` });
  });

  return res.json({ data: { submitted: updated.length } });
}

export async function getTeamTimesheets(req: Request, res: Response) {
  const weekStartStr = (req.query.weekStart as string) || toDateStr(getWeekStart(toDateStr(new Date())));

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      employeeId: timesheetEntries.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeCode: employees.employeeCode,
      weekStart: timesheetEntries.weekStart,
      status: timesheetEntries.status,
      totalHours: sql<string>`SUM(${timesheetEntries.hours})`,
      entryCount: sql<number>`COUNT(*)`,
      submittedAt: timesheetEntries.submittedAt,
    })
      .from(timesheetEntries)
      .innerJoin(employees, eq(timesheetEntries.employeeId, employees.id))
      .where(eq(timesheetEntries.weekStart, weekStartStr))
      .groupBy(timesheetEntries.employeeId, employees.firstName, employees.lastName, employees.employeeCode, timesheetEntries.weekStart, timesheetEntries.status, timesheetEntries.submittedAt)
  );

  // Group by employee, pick the dominant status
  const byEmp: Record<string, any> = {};
  rows.forEach(r => {
    if (!byEmp[r.employeeId]) {
      byEmp[r.employeeId] = { ...r, totalHours: 0 };
    }
    byEmp[r.employeeId].totalHours += Number(r.totalHours);
    // Priority: SUBMITTED > APPROVED > REJECTED > DRAFT
    const pri = { SUBMITTED: 4, APPROVED: 3, REJECTED: 2, DRAFT: 1 } as Record<string, number>;
    if ((pri[r.status] || 0) > (pri[byEmp[r.employeeId].status] || 0)) {
      byEmp[r.employeeId].status = r.status;
      byEmp[r.employeeId].submittedAt = r.submittedAt;
    }
  });

  return res.json({ data: Object.values(byEmp), weekStart: weekStartStr });
}

export async function getEmployeeWeekDetail(req: Request, res: Response) {
  const { employeeId } = req.params;
  const weekStartStr = req.query.weekStart as string;
  if (!weekStartStr) return res.status(400).json({ error: 'weekStart required' });

  const entries = await req.runInTenant!(async (db) =>
    db.select({
      id: timesheetEntries.id,
      projectId: timesheetEntries.projectId,
      projectName: projects.name,
      entryDate: timesheetEntries.entryDate,
      hours: timesheetEntries.hours,
      taskDescription: timesheetEntries.taskDescription,
      billable: timesheetEntries.billable,
      status: timesheetEntries.status,
    })
      .from(timesheetEntries)
      .innerJoin(projects, eq(timesheetEntries.projectId, projects.id))
      .where(and(
        eq(timesheetEntries.employeeId, employeeId),
        eq(timesheetEntries.weekStart, weekStartStr),
      ))
  );
  return res.json({ data: entries });
}

export async function reviewWeek(req: Request, res: Response) {
  const { employeeId } = req.params;
  const { weekStart, action, reviewNote } = req.body;
  if (!weekStart || !action) return res.status(400).json({ error: 'weekStart and action required' });
  if (!['APPROVED', 'REJECTED'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  const updated = await req.runInTenant!(async (db) =>
    db.update(timesheetEntries)
      .set({ status: action, reviewedBy: req.user!.userId, reviewedAt: new Date(), reviewNote: reviewNote || null, updatedAt: new Date() })
      .where(and(
        eq(timesheetEntries.employeeId, employeeId),
        eq(timesheetEntries.weekStart, weekStart),
        eq(timesheetEntries.status, 'SUBMITTED'),
      )).returning()
  );

  if (!updated.length) return res.status(400).json({ error: 'No submitted entries found for this week' });

  await req.runInTenant!(async (db) => {
    await audit({ db, userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, action: `timesheet.${action.toLowerCase()}`, entity: 'timesheet_entries', entityId: employeeId, details: `Week ${weekStart}` });

    const [emp] = await db.select({ userId: users.id })
      .from(employees)
      .innerJoin(users, eq(users.employeeId, employees.id))
      .where(eq(employees.id, employeeId));
    if (emp) {
      await notify({ db, schemaName: req.tenant!.schemaName, userId: emp.userId, type: 'DEFAULT', title: `Timesheet ${action === 'APPROVED' ? 'Approved' : 'Rejected'}`, message: `Your timesheet for week of ${weekStart} has been ${action.toLowerCase()}.${reviewNote ? ' Note: ' + reviewNote : ''}`, linkPath: '/timesheet' });
    }
  });

  return res.json({ data: { reviewed: updated.length, action } });
}
