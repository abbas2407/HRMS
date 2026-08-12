import { Request, Response } from 'express';
import {
  leaveRequests, leaveBalances, leaveTypes, employees, departments,
  holidays, users,
} from '../../shared/db/tenant.schema';
import { eq, and, gte, lte, desc, sql, or } from 'drizzle-orm';
import { pushToUsers } from '../../shared/utils/push';
import { z } from 'zod';

const createSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isHalfDay: z.boolean().default(false),
  halfDaySession: z.enum(['AM', 'PM']).optional(),
  reason: z.string().optional(),
});

function countWorkingDays(start: string, end: string, holidayDates: Set<string>, isHalfDay: boolean): number {
  if (isHalfDay) return 0.5;
  const d = new Date(start);
  const e = new Date(end);
  let count = 0;
  while (d <= e) {
    const dow = d.getDay();
    const ds = d.toISOString().split('T')[0];
    if (dow !== 0 && dow !== 6 && !holidayDates.has(ds)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function createLeaveRequest(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const empId = req.user!.employeeId;
  if (!empId) return res.status(400).json({ error: 'Employee profile not associated with this account' });
  const { leaveTypeId, startDate, endDate, isHalfDay, halfDaySession, reason } = parsed.data;

  if (endDate < startDate) return res.status(400).json({ error: 'End date must be after start date' });

  // Get leave type + check notice days
  const [lt] = await req.runInTenant!(async (db) =>
    db.select().from(leaveTypes).where(eq(leaveTypes.id, leaveTypeId)).limit(1)
  );
  if (!lt || !lt.isActive) return res.status(400).json({ error: 'Invalid leave type' });

  const today = new Date().toISOString().split('T')[0];
  const noticeDays = lt.minNoticeDays ?? 0;
  if (noticeDays > 0) {
    const earliest = new Date();
    earliest.setDate(earliest.getDate() + noticeDays);
    if (startDate < earliest.toISOString().split('T')[0]) {
      return res.status(400).json({ error: `Requires ${noticeDays} days advance notice` });
    }
  }

  // Check no overlapping approved/pending request
  const [overlap] = await req.runInTenant!(async (db) =>
    db.select({ id: leaveRequests.id }).from(leaveRequests)
      .where(and(
        eq(leaveRequests.employeeId, empId),
        or(
          and(lte(leaveRequests.startDate, endDate), gte(leaveRequests.endDate, startDate)),
        ),
        or(
          eq(leaveRequests.status as any, 'PENDING'),
          eq(leaveRequests.status as any, 'APPROVED'),
        ),
      )).limit(1)
  );
  if (overlap) return res.status(409).json({ error: 'An overlapping leave request already exists' });

  // Count days (excluding weekends + holidays)
  const holidayRows = await req.runInTenant!(async (db) =>
    db.select({ date: holidays.date }).from(holidays)
      .where(and(gte(holidays.date, startDate), lte(holidays.date, endDate), eq(holidays.isActive, true)))
  );
  const holidaySet = new Set(holidayRows.map(h => h.date));
  const daysCount = countWorkingDays(startDate, endDate, holidaySet, isHalfDay);

  if (daysCount === 0) return res.status(400).json({ error: 'No working days in selected range' });

  // Check balance (if leave type has a yearly cap and requiresApproval = false we still check)
  const year = new Date(startDate).getFullYear();
  const [bal] = await req.runInTenant!(async (db) =>
    db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, empId),
        eq(leaveBalances.leaveTypeId, leaveTypeId),
        eq(leaveBalances.year, year),
      )).limit(1)
  );

  const availableBalance = parseFloat(String(bal?.balance ?? '0')) - parseFloat(String(bal?.tentative ?? '0'));
  if (lt.maxDaysPerYear !== null && lt.maxDaysPerYear !== undefined && availableBalance < daysCount) {
    return res.status(400).json({
      error: `Insufficient leave balance. Available: ${availableBalance.toFixed(1)} day(s), Requested: ${daysCount}`,
    });
  }

  const [row] = await req.runInTenant!(async (db) => {
    const [req2] = await db.insert(leaveRequests).values({
      employeeId: empId,
      leaveTypeId,
      startDate,
      endDate,
      isHalfDay,
      halfDaySession: halfDaySession ?? null,
      daysCount: String(daysCount),
      reason: reason ?? null,
      status: lt.requiresApproval ? 'PENDING' : 'APPROVED',
    }).returning();

    // If auto-approved or no approval needed, deduct immediately
    if (!lt.requiresApproval && bal) {
      await db.update(leaveBalances).set({
        consumed: sql`${leaveBalances.consumed} + ${String(daysCount)}`,
      }).where(eq(leaveBalances.id, bal.id));
    } else if (bal) {
      // Mark as tentative
      await db.update(leaveBalances).set({
        tentative: sql`${leaveBalances.tentative} + ${String(daysCount)}`,
      }).where(eq(leaveBalances.id, bal.id));
    }

    return [req2];
  });

  return res.status(201).json({ data: row });
}

export async function listLeaveRequests(req: Request, res: Response) {
  const isHR = req.user!.role === 'HR_ADMIN';
  const empId = req.user!.employeeId;
  const { status, employeeId, from, to } = req.query as Record<string, string>;

  const data = await req.runInTenant!(async (db) => {
    const conditions: any[] = [];
    if (!isHR) {
      if (!empId) return [];
      conditions.push(eq(leaveRequests.employeeId, empId));
    }
    else if (employeeId) conditions.push(eq(leaveRequests.employeeId, employeeId));
    if (status) conditions.push(eq(leaveRequests.status as any, status));
    if (from) conditions.push(gte(leaveRequests.startDate, from));
    if (to) conditions.push(lte(leaveRequests.endDate, to));

    return db.select({
      id: leaveRequests.id,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      isHalfDay: leaveRequests.isHalfDay,
      halfDaySession: leaveRequests.halfDaySession,
      daysCount: leaveRequests.daysCount,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      reviewComment: leaveRequests.reviewComment,
      createdAt: leaveRequests.createdAt,
      reviewedAt: leaveRequests.reviewedAt,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentName: departments.name,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
      isPaid: leaveTypes.isPaid,
    })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveRequests.createdAt));
  });

  return res.json({ data });
}

export async function approveLeaveRequest(req: Request, res: Response) {
  const id = String(req.params.id);
  const { comment } = req.body;

  await req.runInTenant!(async (db) => {
    const [lr] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    if (!lr) throw { status: 404, message: 'Not found' };
    if (lr.status !== 'PENDING') throw { status: 400, message: 'Request already processed' };

    await db.update(leaveRequests).set({
      status: 'APPROVED',
      reviewedBy: req.user!.userId,
      reviewComment: comment ?? null,
      reviewedAt: new Date(),
    }).where(eq(leaveRequests.id, id));

    const year = new Date(lr.startDate).getFullYear();
    const [bal] = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, lr.employeeId),
        eq(leaveBalances.leaveTypeId, lr.leaveTypeId),
        eq(leaveBalances.year, year),
      )).limit(1);

    if (bal) {
      const days = String(lr.daysCount ?? '0');
      await db.update(leaveBalances).set({
        consumed: sql`${leaveBalances.consumed} + ${days}`,
        tentative: sql`GREATEST(${leaveBalances.tentative} - ${days}, 0)`,
      }).where(eq(leaveBalances.id, bal.id));
    }
  }).catch((err) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  });

  // Fire-and-forget push to employee
  req.runInTenant!(async (db) => {
    const [lr] = await db.select({ employeeId: leaveRequests.employeeId }).from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    if (!lr) return;
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.employeeId, lr.employeeId)).limit(1);
    if (u) pushToUsers(req.runInTenant, [u.id], 'Leave Approved', 'Your leave request has been approved.').catch(() => {});
  }).catch(() => {});

  return res.json({ data: { message: 'Request approved' } });
}

export async function rejectLeaveRequest(req: Request, res: Response) {
  const id = String(req.params.id);
  const { comment } = req.body;

  await req.runInTenant!(async (db) => {
    const [lr] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    if (!lr) throw { status: 404, message: 'Not found' };
    if (lr.status !== 'PENDING') throw { status: 400, message: 'Request already processed' };

    await db.update(leaveRequests).set({
      status: 'REJECTED',
      reviewedBy: req.user!.userId,
      reviewComment: comment ?? null,
      reviewedAt: new Date(),
    }).where(eq(leaveRequests.id, id));

    // Release tentative hold
    const year = new Date(lr.startDate).getFullYear();
    const [bal] = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, lr.employeeId),
        eq(leaveBalances.leaveTypeId, lr.leaveTypeId),
        eq(leaveBalances.year, year),
      )).limit(1);
    if (bal) {
      const days = String(lr.daysCount ?? '0');
      await db.update(leaveBalances).set({
        tentative: sql`GREATEST(${leaveBalances.tentative} - ${days}, 0)`,
      }).where(eq(leaveBalances.id, bal.id));
    }
  }).catch((err) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  });

  req.runInTenant!(async (db) => {
    const [lr] = await db.select({ employeeId: leaveRequests.employeeId }).from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    if (!lr) return;
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.employeeId, lr.employeeId)).limit(1);
    if (u) pushToUsers(req.runInTenant, [u.id], 'Leave Rejected', 'Your leave request has been rejected.').catch(() => {});
  }).catch(() => {});

  return res.json({ data: { message: 'Request rejected' } });
}

export async function cancelLeaveRequest(req: Request, res: Response) {
  const id = String(req.params.id);
  const empId = req.user!.employeeId;
  if (!empId) return res.status(400).json({ error: 'Employee profile not associated with this account' });

  await req.runInTenant!(async (db) => {
    const [lr] = await db.select().from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.employeeId, empId))).limit(1);
    if (!lr) throw { status: 404, message: 'Not found' };
    if (lr.status === 'CANCELLED') throw { status: 400, message: 'Already cancelled' };

    await db.update(leaveRequests).set({ status: 'CANCELLED' }).where(eq(leaveRequests.id, id));

    const year = new Date(lr.startDate).getFullYear();
    const [bal] = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, empId),
        eq(leaveBalances.leaveTypeId, lr.leaveTypeId),
        eq(leaveBalances.year, year),
      )).limit(1);
    if (bal) {
      const days = String(lr.daysCount ?? '0');
      if (lr.status === 'APPROVED') {
        await db.update(leaveBalances).set({
          consumed: sql`GREATEST(${leaveBalances.consumed} - ${days}, 0)`,
        }).where(eq(leaveBalances.id, bal.id));
      } else if (lr.status === 'PENDING') {
        await db.update(leaveBalances).set({
          tentative: sql`GREATEST(${leaveBalances.tentative} - ${days}, 0)`,
        }).where(eq(leaveBalances.id, bal.id));
      }
    }
  }).catch((err) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  });

  return res.json({ data: { message: 'Request cancelled' } });
}
