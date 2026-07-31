import { Request, Response } from 'express';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import {
  employees, payslips, payrollRuns, departments, employeeSalary,
} from '../../shared/db/tenant.schema';
import { decrypt } from '../../shared/utils/crypto';
import { z } from 'zod';

// Safe decrypt — returns masked value if decryption fails (field might not be encrypted)
function safeDecrypt(val: string | null | undefined): string {
  if (!val) return '';
  try {
    if (val.split(':').length === 3) return decrypt(val);
    return val; // not encrypted (legacy or plain)
  } catch {
    return val;
  }
}

// ─── PF / ECR ─────────────────────────────────────────────────────────────────
// GET /compliance/pf?month=6&year=2025
export async function getPFReport(req: Request, res: Response) {
  const parsed = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide month and year' });
  const { month, year } = parsed.data;

  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns)
      .where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, year)))
      .limit(1)
  );
  if (!run) return res.status(404).json({ error: `No payroll run found for ${month}/${year}` });

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: payslips.id,
      lopDays: payslips.lopDays,
      basic: payslips.basic,
      earnedGross: payslips.earnedGross,
      pfEmployee: payslips.pfEmployee,
      pfEmployer: payslips.pfEmployer,
      workingDays: payslips.workingDays,
      presentDays: payslips.presentDays,
      empId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      uanNumber: employees.uanNumber,
      dob: employees.dob,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payrollRunId, run.id))
  );

  const data = rows.map((r) => {
    const epfWages = Math.min(parseFloat(r.basic || '0'), 15000);
    const eeContribution = parseFloat(r.pfEmployee || '0');
    const erContribution = parseFloat(r.pfEmployer || '0');
    const eps = Math.round(epfWages * 0.0833);    // 8.33% — goes to EPS
    const epfEmployer = Math.round(epfWages * 0.0367); // 3.67% — goes to EPF
    return {
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`,
      uan: r.uanNumber || '',
      dob: r.dob || '',
      grossWages: parseFloat(r.earnedGross || '0'),
      epfWages,
      eeContribution,
      eps,
      epfEmployer,
      erContribution,
      ncpDays: parseFloat(r.lopDays || '0'),
      workingDays: r.workingDays || 0,
    };
  });

  const summary = {
    totalEE: data.reduce((s, r) => s + r.eeContribution, 0),
    totalEPS: data.reduce((s, r) => s + r.eps, 0),
    totalEPFEmployer: data.reduce((s, r) => s + r.epfEmployer, 0),
    totalER: data.reduce((s, r) => s + r.erContribution, 0),
    employeeCount: data.length,
  };

  return res.json({ data, summary, month, year, runStatus: run.status });
}

// ─── ESIC ──────────────────────────────────────────────────────────────────────
// GET /compliance/esic?month=6&year=2025
export async function getESICReport(req: Request, res: Response) {
  const parsed = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide month and year' });
  const { month, year } = parsed.data;

  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns)
      .where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, year))).limit(1)
  );
  if (!run) return res.status(404).json({ error: `No payroll run found for ${month}/${year}` });

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      earnedGross: payslips.earnedGross,
      esicEmployee: payslips.esicEmployee,
      esicEmployer: payslips.esicEmployer,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      esicIpNumber: employees.esicIpNumber,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payrollRunId, run.id))
  );

  // Only include employees eligible for ESIC (gross ≤ ₹21,000)
  const data = rows
    .filter(r => parseFloat(r.earnedGross || '0') <= 21000)
    .map((r) => ({
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`,
      ipNumber: r.esicIpNumber || '',
      grossWages: parseFloat(r.earnedGross || '0'),
      eeContribution: parseFloat(r.esicEmployee || '0'),
      erContribution: parseFloat(r.esicEmployer || '0'),
      totalContribution: parseFloat(r.esicEmployee || '0') + parseFloat(r.esicEmployer || '0'),
    }));

  const summary = {
    totalEE: data.reduce((s, r) => s + r.eeContribution, 0),
    totalER: data.reduce((s, r) => s + r.erContribution, 0),
    eligibleCount: data.length,
  };

  return res.json({ data, summary, month, year, runStatus: run.status });
}

// ─── Professional Tax ─────────────────────────────────────────────────────────
// GET /compliance/pt?month=6&year=2025
export async function getPTReport(req: Request, res: Response) {
  const parsed = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide month and year' });
  const { month, year } = parsed.data;

  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns)
      .where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, year))).limit(1)
  );
  if (!run) return res.status(404).json({ error: `No payroll run found for ${month}/${year}` });

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      earnedGross: payslips.earnedGross,
      professionalTax: payslips.professionalTax,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      workLocation: employees.workLocation,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payrollRunId, run.id))
  );

  const data = rows
    .filter(r => parseFloat(r.professionalTax || '0') > 0)
    .map((r) => ({
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`,
      state: (r.workLocation || 'Unknown').toUpperCase().slice(0, 2),
      earnedGross: parseFloat(r.earnedGross || '0'),
      professionalTax: parseFloat(r.professionalTax || '0'),
    }));

  const totalPT = data.reduce((s, r) => s + r.professionalTax, 0);

  return res.json({ data, totalPT, month, year, runStatus: run.status });
}

// ─── Form 24Q (Quarterly TDS Return) ─────────────────────────────────────────
// GET /compliance/form24q?quarter=1&year=2025
// Quarter 1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
export async function getForm24Q(req: Request, res: Response) {
  const parsed = z.object({ quarter: z.coerce.number().int().min(1).max(4), year: z.coerce.number().int() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide quarter (1-4) and financial year start (e.g. 2025 for FY 2025-26)' });
  const { quarter, year } = parsed.data;

  // Map quarter to months (India FY April-March)
  const quarterMonths: Record<number, number[]> = {
    1: [4, 5, 6],
    2: [7, 8, 9],
    3: [10, 11, 12],
    4: [1, 2, 3],
  };
  const months = quarterMonths[quarter];
  const actualYear = quarter === 4 ? year + 1 : year;

  // Find all DISBURSED runs for the quarter
  const runs = await req.runInTenant!(async (db) =>
    db.select({ id: payrollRuns.id, month: payrollRuns.month, year: payrollRuns.year })
      .from(payrollRuns)
      .where(and(
        inArray(payrollRuns.month, months),
        eq(payrollRuns.year, actualYear),
        eq(payrollRuns.status as any, 'DISBURSED'),
      ))
  );

  if (runs.length === 0) return res.json({ data: [], quarter, year, months, runIds: [], message: 'No disbursed runs found for this quarter' });

  const runIds = runs.map(r => r.id);

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      panNumber: employees.panNumber,
      earnedGross: payslips.earnedGross,
      tds: payslips.tds,
      month: payrollRuns.month,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .where(inArray(payslips.payrollRunId, runIds))
  );

  // Aggregate by employee
  const byEmp: Record<string, any> = {};
  for (const r of rows) {
    const pan = safeDecrypt(r.panNumber);
    if (!byEmp[r.employeeCode]) {
      byEmp[r.employeeCode] = {
        employeeCode: r.employeeCode,
        name: `${r.firstName} ${r.lastName}`,
        pan: pan || 'PANNOTAVBL',
        totalSalary: 0,
        totalTDS: 0,
        months: [],
      };
    }
    byEmp[r.employeeCode].totalSalary += parseFloat(r.earnedGross || '0');
    byEmp[r.employeeCode].totalTDS += parseFloat(r.tds || '0');
    byEmp[r.employeeCode].months.push(r.month);
  }

  const data = Object.values(byEmp);
  const summary = {
    totalSalary: data.reduce((s: number, r: any) => s + r.totalSalary, 0),
    totalTDS: data.reduce((s: number, r: any) => s + r.totalTDS, 0),
    employeeCount: data.length,
    quarterLabel: `Q${quarter} FY ${year}-${String(year + 1).slice(2)}`,
  };

  return res.json({ data, summary, quarter, year });
}

// ─── Bank NEFT / Salary Disbursement File ─────────────────────────────────────
// GET /compliance/neft?runId=xxx
export async function getNEFTFile(req: Request, res: Response) {
  const runId = String(req.query.runId || '');
  if (!runId) return res.status(400).json({ error: 'Provide runId' });

  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).limit(1)
  );
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  if (run.status === 'DRAFT') return res.status(400).json({ error: 'NEFT file available only for LOCKED or DISBURSED runs' });

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      netSalary: payslips.netSalary,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      bankAccount: employees.bankAccount,
      bankIfsc: employees.bankIfsc,
      bankName: employees.bankName,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.payrollRunId, runId))
  );

  const data = rows.map((r) => ({
    employeeCode: r.employeeCode,
    name: `${r.firstName} ${r.lastName}`,
    bankAccount: safeDecrypt(r.bankAccount),
    bankIfsc: r.bankIfsc || '',
    bankName: r.bankName || '',
    netSalary: parseFloat(r.netSalary || '0'),
  }));

  const totalAmount = data.reduce((s, r) => s + r.netSalary, 0);

  return res.json({
    data,
    totalAmount,
    month: run.month,
    year: run.year,
    runId,
    runStatus: run.status,
  });
}

// ─── Form 16 (Annual TDS Certificate) ────────────────────────────────────────
// GET /compliance/form16?fy=2025               → all employees
// GET /compliance/form16?fy=2025&empId=xxx     → single employee
// FY 2025 = April 2025 – March 2026
export async function getForm16(req: Request, res: Response) {
  const parsed = z.object({ fy: z.coerce.number().int(), empId: z.string().uuid().optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide fy (financial year start, e.g. 2025 for FY 2025-26)' });
  const { fy, empId } = parsed.data;

  // FY months: Apr(4)–Dec(12) of `fy`, Jan(1)–Mar(3) of `fy+1`
  const runs = await req.runInTenant!(async (db) =>
    db.select({ id: payrollRuns.id, month: payrollRuns.month, year: payrollRuns.year })
      .from(payrollRuns)
      .where(eq(payrollRuns.status as any, 'DISBURSED'))
  );

  const fyRuns = runs.filter(r =>
    (r.year === fy && r.month >= 4) || (r.year === fy + 1 && r.month <= 3)
  );

  if (fyRuns.length === 0) return res.json({ data: [], fy, message: 'No disbursed runs found for this financial year' });

  const runIds = fyRuns.map(r => r.id);

  const conditions = empId
    ? and(inArray(payslips.payrollRunId, runIds), eq(payslips.employeeId, empId))
    : inArray(payslips.payrollRunId, runIds);

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      panNumber: employees.panNumber,
      earnedGross: payslips.earnedGross,
      basic: payslips.basic,
      hra: payslips.hra,
      pfEmployee: payslips.pfEmployee,
      tds: payslips.tds,
      month: payrollRuns.month,
      year: payrollRuns.year,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .where(conditions as any)
  );

  // Aggregate by employee
  const byEmp: Record<string, any> = {};
  for (const r of rows) {
    const pan = safeDecrypt(r.panNumber);
    if (!byEmp[r.employeeCode]) {
      byEmp[r.employeeCode] = {
        employeeCode: r.employeeCode,
        name: `${r.firstName} ${r.lastName}`,
        pan: pan || 'PANNOTAVBL',
        totalGross: 0,
        totalBasic: 0,
        totalHRA: 0,
        totalPFEmployee: 0,
        totalTDS: 0,
        months: 0,
      };
    }
    const e = byEmp[r.employeeCode];
    e.totalGross += parseFloat(r.earnedGross || '0');
    e.totalBasic += parseFloat(r.basic || '0');
    e.totalHRA += parseFloat(r.hra || '0');
    e.totalPFEmployee += parseFloat(r.pfEmployee || '0');
    e.totalTDS += parseFloat(r.tds || '0');
    e.months += 1;
  }

  // Add derived fields
  const data = Object.values(byEmp).map((e: any) => ({
    ...e,
    // Gross taxable = earned gross - standard deduction (75k, already in TDS calc)
    taxableIncome: Math.max(0, e.totalGross - 75000),
    fyLabel: `FY ${fy}-${String(fy + 1).slice(2)}`,
  }));

  return res.json({ data, fy, fyLabel: `FY ${fy}-${String(fy + 1).slice(2)}`, employeeCount: data.length });
}

// ─── List available payroll runs (for UI dropdowns) ───────────────────────────
export async function getAvailableRuns(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select({ id: payrollRuns.id, month: payrollRuns.month, year: payrollRuns.year, status: payrollRuns.status })
      .from(payrollRuns).orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
  );
  return res.json({ data });
}
