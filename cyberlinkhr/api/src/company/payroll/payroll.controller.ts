import { Request, Response } from 'express';
import {
  payrollRuns, payslips, employees, employeeSalary, salaryStructures,
  attendanceLogs, leaveRequests, leaveTypes, companySettings, departments, holidays,
} from '../../shared/db/tenant.schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { calculatePayslip } from '../../shared/utils/payroll-calc';
import { z } from 'zod';

function workingDaysInMonth(year: number, month: number, holidayDates: Set<string>): number {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const ds = d.toISOString().split('T')[0];
      if (!holidayDates.has(ds)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function buildPayslipForEmployee(
  emp: { id: string },
  payrollRunId: string,
  year: number,
  month: number,
  workingDays: number,
  companyState: string,
  salaryMap: Map<string, { gross: string; structureId: string | null }>,
  structureMap: Map<string, { basicPct: string | null; hraPct: string | null; specialPct: string | null }>,
  attendanceMap: Map<string, Array<{ status: string | null; date: string }>>,
  leaveMap: Map<string, Array<{ startDate: string; endDate: string }>>,
) {
  const salRow = salaryMap.get(emp.id);
  if (!salRow) return null;

  const structure = salRow.structureId ? structureMap.get(salRow.structureId) : null;
  const basicPct = structure ? parseFloat(String(structure.basicPct)) : 50;
  const hraPct = structure ? parseFloat(String(structure.hraPct)) : 20;
  const specialPct = structure ? parseFloat(String(structure.specialPct)) : 30;
  const grossSalary = parseFloat(String(salRow.gross));

  const attRows = attendanceMap.get(emp.id) || [];
  let presentDays = 0;
  for (const a of attRows) {
    if (a.status === 'PRESENT' || a.status === 'LATE') presentDays += 1;
    else if (a.status === 'HALF_DAY') presentDays += 0.5;
    else if (a.status === 'LEAVE' || a.status === 'HOLIDAY' || a.status === 'WEEK_OFF') presentDays += 1;
  }

  const attendanceDatesWithLeave = new Set(
    attRows.filter(a => a.status === 'LEAVE').map(a => a.date)
  );

  const empLeaves = leaveMap.get(emp.id) || [];
  for (const leave of empLeaves) {
    const cur = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    while (cur <= end) {
      const ds = cur.toISOString().split('T')[0];
      if (!attendanceDatesWithLeave.has(ds)) presentDays += 1;
      cur.setDate(cur.getDate() + 1);
    }
  }

  const calc = calculatePayslip({
    grossSalary,
    basicPct,
    hraPct,
    specialPct,
    presentDays: Math.min(presentDays, workingDays),
    workingDays,
    state: companyState,
    month,
  });

  return {
    payrollRunId,
    employeeId: emp.id,
    workingDays,
    presentDays: String(Math.min(presentDays, workingDays)),
    lopDays: String(calc.lopDays),
    grossSalary: String(calc.grossSalary),
    earnedGross: String(calc.earnedGross),
    basic: String(calc.basic),
    hra: String(calc.hra),
    specialAllowance: String(calc.specialAllowance),
    otherEarnings: calc.otherEarnings,
    lopAmount: String(calc.lopAmount),
    pfEmployee: String(calc.pfEmployee),
    pfEmployer: String(calc.pfEmployer),
    esicEmployee: String(calc.esicEmployee),
    esicEmployer: String(calc.esicEmployer),
    professionalTax: String(calc.professionalTax),
    tds: String(calc.tds),
    otherDeductions: calc.otherDeductions,
    totalDeductions: String(calc.totalDeductions),
    netSalary: String(calc.netSalary),
  };
}

// POST /payroll/runs — create draft run for month/year
export async function createPayrollRun(req: Request, res: Response) {
  const parsed = z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { month, year } = parsed.data;

  // Check no duplicate
  const [existing] = await req.runInTenant!(async (db) =>
    db.select({ id: payrollRuns.id, status: payrollRuns.status })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, year))).limit(1)
  );
  if (existing) return res.status(409).json({ error: `Payroll run for ${month}/${year} already exists`, existing });

  // Get company state setting
  const [stateSetting] = await req.runInTenant!(async (db) =>
    db.select().from(companySettings).where(eq(companySettings.key, 'state')).limit(1)
  );
  const companyState = stateSetting?.value || 'MH';

  // Working days calculation — load company holidays for this month
  const monthIdx = month - 1; // 0-indexed
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, monthIdx + 1, 0).toISOString().split('T')[0];

  const holidayRows = await req.runInTenant!(async (db) =>
    db.select({ date: holidays.date })
      .from(holidays)
      .where(and(gte(holidays.date, monthStart), lte(holidays.date, monthEnd)))
  );
  const holidayDates = new Set(holidayRows.map(h => h.date));
  const wDays = workingDaysInMonth(year, monthIdx, holidayDates);

  // Create run
  const [run] = await req.runInTenant!(async (db) =>
    db.insert(payrollRuns).values({ month, year, status: 'DRAFT' }).returning()
  );

  // Generate payslips for all ACTIVE employees with salary
  const activeEmps = await req.runInTenant!(async (db) =>
    db.select({ id: employees.id, employeeCode: employees.employeeCode, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees).where(eq(employees.status, 'ACTIVE'))
  );

  // --- Batch load all data upfront (4 queries for ALL employees instead of 4 per employee) ---
  const empIds = activeEmps.map(e => e.id);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;

  const [allSalaries, allStructures, allAttendance, allLeaves] = await Promise.all([
    // All salary rows effective before this month, ordered newest-first
    empIds.length > 0
      ? req.runInTenant!(async (db) =>
          db.select({ employeeId: employeeSalary.employeeId, gross: employeeSalary.gross, structureId: employeeSalary.structureId, effectiveFrom: employeeSalary.effectiveFrom })
            .from(employeeSalary)
            .where(and(inArray(employeeSalary.employeeId, empIds), lte(employeeSalary.effectiveFrom, from)))
            .orderBy(desc(employeeSalary.effectiveFrom))
        )
      : Promise.resolve([]),
    // All salary structures
    req.runInTenant!(async (db) => db.select().from(salaryStructures)),
    // All attendance logs for the month
    empIds.length > 0
      ? req.runInTenant!(async (db) =>
          db.select({ employeeId: attendanceLogs.employeeId, status: attendanceLogs.status, date: attendanceLogs.date })
            .from(attendanceLogs)
            .where(and(inArray(attendanceLogs.employeeId, empIds), gte(attendanceLogs.date, monthStart), lte(attendanceLogs.date, monthEnd)))
        )
      : Promise.resolve([]),
    // All approved leaves overlapping the month
    empIds.length > 0
      ? req.runInTenant!(async (db) =>
          db.select({ employeeId: leaveRequests.employeeId, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
            .from(leaveRequests)
            .where(and(
              inArray(leaveRequests.employeeId, empIds),
              eq(leaveRequests.status as any, 'APPROVED'),
              gte(leaveRequests.endDate, monthStart),
              lte(leaveRequests.startDate, monthEnd),
            ))
        )
      : Promise.resolve([]),
  ]);

  // Build lookup maps
  const salaryMap = new Map<string, { gross: string; structureId: string | null }>();
  for (const s of allSalaries) {
    if (!salaryMap.has(s.employeeId)) {
      salaryMap.set(s.employeeId, { gross: String(s.gross), structureId: s.structureId });
    }
  }

  const structureMap = new Map(allStructures.map(s => [s.id, s]));

  const attendanceMap = new Map<string, Array<{ status: string | null; date: string }>>();
  for (const a of allAttendance) {
    if (!attendanceMap.has(a.employeeId)) attendanceMap.set(a.employeeId, []);
    attendanceMap.get(a.employeeId)!.push({ status: a.status, date: a.date });
  }

  const leaveMap = new Map<string, Array<{ startDate: string; endDate: string }>>();
  for (const l of allLeaves) {
    if (!leaveMap.has(l.employeeId)) leaveMap.set(l.employeeId, []);
    leaveMap.get(l.employeeId)!.push({ startDate: l.startDate, endDate: l.endDate });
  }
  // --- End batch load ---

  let totalGross = 0, totalNet = 0, totalPfEe = 0, totalPfEr = 0, totalEsicEe = 0, totalEsicEr = 0, totalPt = 0, totalTds = 0, totalLop = 0;
  const slipValues: any[] = [];

  for (const emp of activeEmps) {
    const slip = buildPayslipForEmployee(emp, run.id, year, monthIdx, wDays, companyState, salaryMap, structureMap, attendanceMap, leaveMap);
    if (!slip) continue;
    slipValues.push(slip);
    totalGross += parseFloat(slip.grossSalary);
    totalNet += parseFloat(slip.netSalary);
    totalPfEe += parseFloat(slip.pfEmployee);
    totalPfEr += parseFloat(slip.pfEmployer);
    totalEsicEe += parseFloat(slip.esicEmployee);
    totalEsicEr += parseFloat(slip.esicEmployer);
    totalPt += parseFloat(slip.professionalTax);
    totalTds += parseFloat(slip.tds);
    totalLop += parseFloat(slip.lopAmount);
  }

  if (slipValues.length > 0) {
    await req.runInTenant!(async (db) => db.insert(payslips).values(slipValues));
  }

  // Update run totals
  await req.runInTenant!(async (db) =>
    db.update(payrollRuns).set({
      totalGross: String(Math.round(totalGross)),
      totalNet: String(Math.round(totalNet)),
      totalLop: String(Math.round(totalLop)),
      totalPfEmployee: String(Math.round(totalPfEe)),
      totalPfEmployer: String(Math.round(totalPfEr)),
      totalEsicEmployee: String(Math.round(totalEsicEe)),
      totalEsicEmployer: String(Math.round(totalEsicEr)),
      totalPt: String(Math.round(totalPt)),
      totalTds: String(Math.round(totalTds)),
    }).where(eq(payrollRuns.id, run.id))
  );

  return res.status(201).json({ data: { ...run, employeeCount: slipValues.length } });
}

// GET /payroll/runs
export async function listPayrollRuns(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns).orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
  );
  return res.json({ data });
}

// GET /payroll/runs/:id
export async function getPayrollRun(req: Request, res: Response) {
  const id = String(req.params.id);
  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1)
  );
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  return res.json({ data: run });
}

// GET /payroll/runs/:id/payslips
export async function getRunPayslips(req: Request, res: Response) {
  const id = String(req.params.id);
  const data = await req.runInTenant!(async (db) =>
    db.select({
      id: payslips.id,
      workingDays: payslips.workingDays,
      presentDays: payslips.presentDays,
      lopDays: payslips.lopDays,
      grossSalary: payslips.grossSalary,
      earnedGross: payslips.earnedGross,
      lopAmount: payslips.lopAmount,
      pfEmployee: payslips.pfEmployee,
      esicEmployee: payslips.esicEmployee,
      professionalTax: payslips.professionalTax,
      tds: payslips.tds,
      totalDeductions: payslips.totalDeductions,
      netSalary: payslips.netSalary,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentName: departments.name,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(payslips.payrollRunId, id))
      .orderBy(employees.employeeCode)
  );
  return res.json({ data });
}

// GET /payroll/payslips/:id  (single payslip detail)
export async function getPayslip(req: Request, res: Response) {
  const id = String(req.params.id);
  const [slip] = await req.runInTenant!(async (db) =>
    db.select({
      id: payslips.id,
      payrollRunId: payslips.payrollRunId,
      workingDays: payslips.workingDays,
      presentDays: payslips.presentDays,
      lopDays: payslips.lopDays,
      grossSalary: payslips.grossSalary,
      earnedGross: payslips.earnedGross,
      basic: payslips.basic,
      hra: payslips.hra,
      specialAllowance: payslips.specialAllowance,
      otherEarnings: payslips.otherEarnings,
      lopAmount: payslips.lopAmount,
      pfEmployee: payslips.pfEmployee,
      pfEmployer: payslips.pfEmployer,
      esicEmployee: payslips.esicEmployee,
      esicEmployer: payslips.esicEmployer,
      professionalTax: payslips.professionalTax,
      tds: payslips.tds,
      otherDeductions: payslips.otherDeductions,
      totalDeductions: payslips.totalDeductions,
      netSalary: payslips.netSalary,
      month: payrollRuns.month,
      year: payrollRuns.year,
      runStatus: payrollRuns.status,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentName: departments.name,
    })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(payslips.id, id)).limit(1)
  );
  if (!slip) return res.status(404).json({ error: 'Payslip not found' });
  return res.json({ data: slip });
}

// GET /payroll/my-payslips
export async function getMyPayslips(req: Request, res: Response) {
  const empId = req.user!.userId;
  const data = await req.runInTenant!(async (db) =>
    db.select({
      id: payslips.id,
      month: payrollRuns.month,
      year: payrollRuns.year,
      grossSalary: payslips.grossSalary,
      netSalary: payslips.netSalary,
      totalDeductions: payslips.totalDeductions,
      workingDays: payslips.workingDays,
      lopDays: payslips.lopDays,
      runStatus: payrollRuns.status,
    })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .where(and(
        eq(payslips.employeeId, empId),
        eq(payrollRuns.status as any, 'DISBURSED'),
      ))
      .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
  );
  return res.json({ data });
}

// GET /payroll/my-payslips/:id  (employee self-service — only own payslips)
export async function getMyPayslipById(req: Request, res: Response) {
  const id = String(req.params.id);
  const empId = req.user!.userId;
  const [slip] = await req.runInTenant!(async (db) =>
    db.select({
      id: payslips.id,
      workingDays: payslips.workingDays,
      presentDays: payslips.presentDays,
      lopDays: payslips.lopDays,
      grossSalary: payslips.grossSalary,
      earnedGross: payslips.earnedGross,
      basic: payslips.basic,
      hra: payslips.hra,
      specialAllowance: payslips.specialAllowance,
      otherEarnings: payslips.otherEarnings,
      lopAmount: payslips.lopAmount,
      pfEmployee: payslips.pfEmployee,
      pfEmployer: payslips.pfEmployer,
      esicEmployee: payslips.esicEmployee,
      esicEmployer: payslips.esicEmployer,
      professionalTax: payslips.professionalTax,
      tds: payslips.tds,
      totalDeductions: payslips.totalDeductions,
      netSalary: payslips.netSalary,
      month: payrollRuns.month,
      year: payrollRuns.year,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentName: departments.name,
    })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(and(eq(payslips.id, id), eq(payslips.employeeId, empId)))
      .limit(1)
  );
  if (!slip) return res.status(404).json({ error: 'Payslip not found' });
  return res.json({ data: slip });
}

// PUT /payroll/runs/:id/lock
export async function lockPayrollRun(req: Request, res: Response) {
  const id = String(req.params.id);
  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1)
  );
  if (!run) return res.status(404).json({ error: 'Not found' });
  if (run.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT runs can be locked' });

  const [updated] = await req.runInTenant!(async (db) =>
    db.update(payrollRuns).set({ status: 'LOCKED', lockedAt: new Date(), lockedBy: req.user!.userId })
      .where(eq(payrollRuns.id, id)).returning()
  );
  return res.json({ data: updated });
}

// PUT /payroll/runs/:id/disburse
export async function disbursePayrollRun(req: Request, res: Response) {
  const id = String(req.params.id);
  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1)
  );
  if (!run) return res.status(404).json({ error: 'Not found' });
  if (run.status !== 'LOCKED') return res.status(400).json({ error: 'Only LOCKED runs can be disbursed' });

  const [updated] = await req.runInTenant!(async (db) =>
    db.update(payrollRuns).set({ status: 'DISBURSED', disbursedAt: new Date() })
      .where(eq(payrollRuns.id, id)).returning()
  );
  return res.json({ data: updated });
}

// DELETE /payroll/runs/:id — only DRAFT
export async function deletePayrollRun(req: Request, res: Response) {
  const id = String(req.params.id);
  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1)
  );
  if (!run) return res.status(404).json({ error: 'Not found' });
  if (run.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT runs can be deleted' });

  await req.runInTenant!(async (db) => {
    await db.delete(payslips).where(eq(payslips.payrollRunId, id));
    await db.delete(payrollRuns).where(eq(payrollRuns.id, id));
  });
  return res.json({ data: { message: 'Payroll run deleted' } });
}
