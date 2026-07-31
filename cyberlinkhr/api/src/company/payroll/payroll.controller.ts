import { Request, Response } from 'express';
import {
  payrollRuns, payslips, employees, employeeSalary, salaryStructures,
  attendanceLogs, leaveRequests, leaveTypes, companySettings, departments,
} from '../../shared/db/tenant.schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
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

async function buildPayslipForEmployee(
  run: Request['runInTenant'],
  emp: any,
  payrollRunId: string,
  year: number,
  month: number,
  workingDays: number,
  companyState: string,
) {
  // Get current salary
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const [salRow] = await run!(async (db) =>
    db.select({ gross: employeeSalary.gross, structureId: employeeSalary.structureId })
      .from(employeeSalary)
      .where(and(eq(employeeSalary.employeeId, emp.id), lte(employeeSalary.effectiveFrom, from)))
      .orderBy(desc(employeeSalary.effectiveFrom))
      .limit(1)
  );
  if (!salRow) return null; // skip employees without salary

  const [structure] = salRow.structureId
    ? await run!(async (db) =>
        db.select().from(salaryStructures).where(eq(salaryStructures.id, salRow.structureId!)).limit(1)
      )
    : [null];

  const basicPct = structure ? parseFloat(String(structure.basicPct)) : 50;
  const hraPct = structure ? parseFloat(String(structure.hraPct)) : 20;
  const specialPct = structure ? parseFloat(String(structure.specialPct)) : 30;
  const grossSalary = parseFloat(String(salRow.gross));

  // Attendance for the month
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const attRows = await run!(async (db) =>
    db.select({ status: attendanceLogs.status, date: attendanceLogs.date })
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.employeeId, emp.id),
        gte(attendanceLogs.date, monthStart),
        lte(attendanceLogs.date, monthEnd),
      ))
  );

  const presentStatuses = new Set(['PRESENT', 'LATE', 'HALF_DAY']);
  let presentDays = 0;
  for (const a of attRows) {
    if (a.status === 'PRESENT' || a.status === 'LATE') presentDays += 1;
    else if (a.status === 'HALF_DAY') presentDays += 0.5;
    else if (a.status === 'LEAVE' || a.status === 'HOLIDAY' || a.status === 'WEEK_OFF') presentDays += 1;
  }

  // Also count approved leave days in this month
  const approvedLeaves = await run!(async (db) =>
    db.select({ daysCount: leaveRequests.daysCount, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.employeeId, emp.id),
        eq(leaveRequests.status as any, 'APPROVED'),
        gte(leaveRequests.endDate, monthStart),
        lte(leaveRequests.startDate, monthEnd),
      ))
  );
  // Note: presentDays already include attendance-level LEAVE. Approved leaves not yet punched are added separately.

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

  // Working days calculation
  const monthIdx = month - 1; // 0-indexed
  // (No holiday data needed for just creating the run - used during calculation)
  const wDays = workingDaysInMonth(year, monthIdx, new Set());

  // Create run
  const [run] = await req.runInTenant!(async (db) =>
    db.insert(payrollRuns).values({ month, year, status: 'DRAFT' }).returning()
  );

  // Generate payslips for all ACTIVE employees with salary
  const activeEmps = await req.runInTenant!(async (db) =>
    db.select({ id: employees.id, employeeCode: employees.employeeCode, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees).where(eq(employees.status, 'ACTIVE'))
  );

  let totalGross = 0, totalNet = 0, totalPfEe = 0, totalPfEr = 0, totalEsicEe = 0, totalEsicEr = 0, totalPt = 0, totalTds = 0, totalLop = 0;
  const slipValues: any[] = [];

  for (const emp of activeEmps) {
    const slip = await buildPayslipForEmployee(req.runInTenant, emp, run.id, year, monthIdx, wDays, companyState);
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
