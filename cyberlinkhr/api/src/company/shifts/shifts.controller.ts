import { Request, Response } from 'express';
import { shifts, shiftAssignments, employees, departments, attendanceLogs } from '../../shared/db/tenant.schema';
import { eq, and, lte, gte, desc, sql, between } from 'drizzle-orm';
import { z } from 'zod';

const shiftSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  graceMinutes: z.number().int().min(0).max(60).default(10),
  isNightShift: z.boolean().default(false),
  weekOffs: z.array(z.number().int().min(0).max(6)).default([0, 6]),
  color: z.string().default('#6366f1'),
});

export async function listShifts(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select({
      id: shifts.id, name: shifts.name, startTime: shifts.startTime,
      endTime: shifts.endTime, graceMinutes: shifts.graceMinutes,
      isNightShift: shifts.isNightShift, weekOffs: shifts.weekOffs,
      color: shifts.color,
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

// GET /shifts/roster?year=&month=&shiftId=&employeeId=
// Returns a grid: each employee row × each day in month with status + shift color
export async function getShiftRoster(req: Request, res: Response) {
  const now = new Date();
  const year = Number(req.query.year ?? now.getFullYear());
  const month = Number(req.query.month ?? now.getMonth() + 1);
  const shiftIdFilter = req.query.shiftId as string | undefined;
  const employeeIdFilter = req.query.employeeId as string | undefined;

  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const data = await req.runInTenant!(async (db) => {
    // Get all active employees with their current shift (effective on `from`)
    const allAssignments = await db
      .select({
        employeeId: shiftAssignments.employeeId,
        shiftId: shiftAssignments.shiftId,
        effectiveFrom: shiftAssignments.effectiveFrom,
        shiftName: shifts.name,
        shiftColor: shifts.color,
        shiftStart: shifts.startTime,
        shiftEnd: shifts.endTime,
        weekOffs: shifts.weekOffs,
      })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .where(lte(shiftAssignments.effectiveFrom, from))
      .orderBy(desc(shiftAssignments.effectiveFrom));

    // Build map: employeeId → latest assignment
    const empShiftMap = new Map<string, typeof allAssignments[0]>();
    for (const a of allAssignments) {
      if (!empShiftMap.has(a.employeeId)) {
        empShiftMap.set(a.employeeId, a);
      }
    }

    // Filter by shiftId if provided
    const filteredEmpIds = shiftIdFilter
      ? [...empShiftMap.entries()].filter(([, a]) => a.shiftId === shiftIdFilter).map(([id]) => id)
      : [...empShiftMap.keys()];

    // Get employee details
    let empQuery = db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        departmentName: departments.name,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.status, 'ACTIVE'));

    const empRows = await empQuery;
    const filteredEmps = empRows.filter(e =>
      filteredEmpIds.includes(e.id) &&
      (!employeeIdFilter || e.id === employeeIdFilter)
    );

    // Get attendance logs for the month
    const logs = await db
      .select({
        employeeId: attendanceLogs.employeeId,
        date: attendanceLogs.date,
        status: attendanceLogs.status,
        punchIn: attendanceLogs.punchIn,
        punchOut: attendanceLogs.punchOut,
        workingHours: attendanceLogs.workingHours,
      })
      .from(attendanceLogs)
      .where(and(gte(attendanceLogs.date, from), lte(attendanceLogs.date, to)));

    // Build date → log map per employee
    const logMap = new Map<string, Map<string, typeof logs[0]>>();
    for (const l of logs) {
      if (!logMap.has(l.employeeId)) logMap.set(l.employeeId, new Map());
      logMap.get(l.employeeId)!.set(l.date, l);
    }

    // Build days array
    const days: { date: string; dayOfWeek: number; label: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      days.push({
        date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayOfWeek: dt.getDay(),
        label: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
      });
    }

    // Build roster rows
    const rows = filteredEmps.map(emp => {
      const assignment = empShiftMap.get(emp.id);
      const empLogs = logMap.get(emp.id) ?? new Map();
      const weekOffs: number[] = (assignment?.weekOffs as number[]) ?? [0, 6];

      const dayData = days.map(day => {
        const log = empLogs.get(day.date);
        const isWeekOff = weekOffs.includes(day.dayOfWeek);
        let cellStatus = 'OFF';
        if (log) {
          cellStatus = log.status ?? 'PRESENT';
        } else if (!isWeekOff) {
          cellStatus = 'A'; // Absent if no log and not week off
        }
        return {
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          label: day.label,
          status: cellStatus,
          isWeekOff,
          punchIn: log?.punchIn ?? null,
          punchOut: log?.punchOut ?? null,
          workingHours: log?.workingHours ?? null,
        };
      });

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        departmentName: emp.departmentName,
        shiftId: assignment?.shiftId ?? null,
        shiftName: assignment?.shiftName ?? null,
        shiftColor: assignment?.shiftColor ?? '#94a3b8',
        shiftStart: assignment?.shiftStart ?? null,
        shiftEnd: assignment?.shiftEnd ?? null,
        workingDays: dayData.filter(d => !d.isWeekOff).length,
        presentDays: dayData.filter(d => d.status === 'PRESENT' || d.status === 'LATE').length,
        days: dayData,
      };
    });

    return { rows, days, meta: { year, month, from, to, daysInMonth } };
  });

  return res.json({ data });
}

// GET /shifts/list — just names and colors (for dropdown)
export async function listShiftNames(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select({ id: shifts.id, name: shifts.name, color: shifts.color, startTime: shifts.startTime, endTime: shifts.endTime })
      .from(shifts)
      .where(eq(shifts.isActive, true))
      .orderBy(shifts.name)
  );
  return res.json({ data });
}
