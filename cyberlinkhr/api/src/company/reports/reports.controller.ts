import { Request, Response } from 'express';
import { eq, and, gte, lte, count, sql, desc, inArray } from 'drizzle-orm';
import {
  employees, departments, designations, attendanceLogs,
  leaveRequests, leaveTypes, leaveBalances, payrollRuns, payslips,
  employeeSalary, salaryStructures,
} from '../../shared/db/tenant.schema';

// ─── Headcount Report ─────────────────────────────────────────────────────────
// GET /reports/headcount
export async function getHeadcountReport(req: Request, res: Response) {
  const [byStatus, byGender, byType, byDept] = await Promise.all([
    req.runInTenant!(async (db) =>
      db.select({ status: employees.status, count: count() })
        .from(employees).groupBy(employees.status)
    ),
    req.runInTenant!(async (db) =>
      db.select({ gender: employees.gender, count: count() })
        .from(employees).where(eq(employees.status, 'ACTIVE')).groupBy(employees.gender)
    ),
    req.runInTenant!(async (db) =>
      db.select({ type: employees.employmentType, count: count() })
        .from(employees).where(eq(employees.status, 'ACTIVE')).groupBy(employees.employmentType)
    ),
    req.runInTenant!(async (db) =>
      db.select({ deptName: departments.name, count: count() })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(eq(employees.status, 'ACTIVE'))
        .groupBy(departments.name)
        .orderBy(desc(count()))
    ),
  ]);

  const totalActive = byStatus.find(s => s.status === 'ACTIVE')?.count ?? 0;
  const totalInactive = byStatus.find(s => s.status === 'INACTIVE')?.count ?? 0;
  const totalSeparated = byStatus.find(s => s.status === 'SEPARATED')?.count ?? 0;

  return res.json({
    data: {
      total: Number(totalActive) + Number(totalInactive) + Number(totalSeparated),
      active: Number(totalActive),
      inactive: Number(totalInactive),
      separated: Number(totalSeparated),
      byGender: byGender.map(r => ({ label: r.gender || 'Unknown', count: Number(r.count) })),
      byType: byType.map(r => ({ label: r.type || 'Unknown', count: Number(r.count) })),
      byDept: byDept.map(r => ({ label: r.deptName || 'No Department', count: Number(r.count) })),
    }
  });
}

// ─── Attendance Summary ───────────────────────────────────────────────────────
// GET /reports/attendance?month=6&year=2025
export async function getAttendanceReport(req: Request, res: Response) {
  const month = parseInt(String(req.query.month)) || new Date().getMonth() + 1;
  const year = parseInt(String(req.query.year)) || new Date().getFullYear();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      status: attendanceLogs.status,
      deptName: departments.name,
      count: count(),
    })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(and(gte(attendanceLogs.date, monthStart), lte(attendanceLogs.date, monthEnd)))
      .groupBy(attendanceLogs.status, departments.name)
  );

  // Overall status breakdown
  const statusMap: Record<string, number> = {};
  for (const r of rows) {
    const s = r.status ?? 'UNKNOWN';
    statusMap[s] = (statusMap[s] || 0) + Number(r.count);
  }
  const total = Object.values(statusMap).reduce((s, v) => s + v, 0);

  // Per-department breakdown
  const deptMap: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const dept = r.deptName || 'No Dept';
    const s = r.status ?? 'UNKNOWN';
    if (!deptMap[dept]) deptMap[dept] = {};
    deptMap[dept][s] = (deptMap[dept][s] || 0) + Number(r.count);
  }

  const byDept = Object.entries(deptMap).map(([dept, statuses]) => {
    const dTotal = Object.values(statuses).reduce((s, v) => s + v, 0);
    const present = (statuses.PRESENT || 0) + (statuses.LATE || 0) + (statuses.HALF_DAY || 0) / 2;
    return {
      dept,
      present: Math.round(present),
      absent: statuses.ABSENT || 0,
      late: statuses.LATE || 0,
      leave: statuses.LEAVE || 0,
      total: dTotal,
      attendanceRate: dTotal > 0 ? Math.round((present / dTotal) * 100) : 0,
    };
  }).sort((a, b) => b.attendanceRate - a.attendanceRate);

  return res.json({
    data: {
      month, year, total,
      present: (statusMap.PRESENT || 0) + (statusMap.LATE || 0),
      absent: statusMap.ABSENT || 0,
      late: statusMap.LATE || 0,
      halfDay: statusMap.HALF_DAY || 0,
      leave: statusMap.LEAVE || 0,
      holiday: (statusMap.HOLIDAY || 0) + (statusMap.WEEK_OFF || 0),
      attendanceRate: total > 0 ? Math.round(((statusMap.PRESENT || 0) + (statusMap.LATE || 0)) / total * 100) : 0,
      byDept,
      statusBreakdown: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    }
  });
}

// ─── Leave Utilisation ────────────────────────────────────────────────────────
// GET /reports/leave?year=2025
export async function getLeaveReport(req: Request, res: Response) {
  const year = parseInt(String(req.query.year)) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [byType, byStatus, byMonth] = await Promise.all([
    req.runInTenant!(async (db) =>
      db.select({
        typeName: leaveTypes.name,
        typeCode: leaveTypes.code,
        status: leaveRequests.status,
        totalDays: sql<number>`SUM(${leaveRequests.daysCount})`,
        requestCount: count(),
      })
        .from(leaveRequests)
        .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(and(gte(leaveRequests.startDate, yearStart), lte(leaveRequests.startDate, yearEnd)))
        .groupBy(leaveTypes.name, leaveTypes.code, leaveRequests.status)
    ),
    req.runInTenant!(async (db) =>
      db.select({ status: leaveRequests.status, count: count() })
        .from(leaveRequests)
        .where(and(gte(leaveRequests.startDate, yearStart), lte(leaveRequests.startDate, yearEnd)))
        .groupBy(leaveRequests.status)
    ),
    req.runInTenant!(async (db) =>
      db.select({
        month: sql<string>`EXTRACT(MONTH FROM ${leaveRequests.startDate}::date)`,
        totalDays: sql<number>`SUM(${leaveRequests.daysCount})`,
        count: count(),
      })
        .from(leaveRequests)
        .where(and(
          gte(leaveRequests.startDate, yearStart),
          lte(leaveRequests.startDate, yearEnd),
          eq(leaveRequests.status as any, 'APPROVED'),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${leaveRequests.startDate}::date)`)
        .orderBy(sql`EXTRACT(MONTH FROM ${leaveRequests.startDate}::date)`)
    ),
  ]);

  // Aggregate by leave type
  const typeMap: Record<string, any> = {};
  for (const r of byType) {
    const key = r.typeCode || r.typeName || 'Unknown';
    if (!typeMap[key]) typeMap[key] = { name: r.typeName, code: r.typeCode, approved: 0, pending: 0, rejected: 0, total: 0 };
    const days = Number(r.totalDays) || 0;
    if (r.status === 'APPROVED') typeMap[key].approved += days;
    else if (r.status === 'PENDING') typeMap[key].pending += days;
    else if (r.status === 'REJECTED') typeMap[key].rejected += days;
    typeMap[key].total += days;
  }

  return res.json({
    data: {
      year,
      byType: Object.values(typeMap).sort((a: any, b: any) => b.approved - a.approved),
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      byMonth: byMonth.map(r => ({
        month: Number(r.month),
        days: Number(r.totalDays) || 0,
        requests: Number(r.count),
      })),
    }
  });
}

// ─── Payroll Cost Trend ───────────────────────────────────────────────────────
// GET /reports/payroll-trend?months=6
export async function getPayrollTrend(req: Request, res: Response) {
  const months = Math.min(parseInt(String(req.query.months)) || 6, 24);

  const runs = await req.runInTenant!(async (db) =>
    db.select({
      id: payrollRuns.id,
      month: payrollRuns.month,
      year: payrollRuns.year,
      status: payrollRuns.status,
      totalGross: payrollRuns.totalGross,
      totalNet: payrollRuns.totalNet,
      totalPfEmployee: payrollRuns.totalPfEmployee,
      totalPfEmployer: payrollRuns.totalPfEmployer,
      totalEsicEmployee: payrollRuns.totalEsicEmployee,
      totalEsicEmployer: payrollRuns.totalEsicEmployer,
      totalPt: payrollRuns.totalPt,
      totalTds: payrollRuns.totalTds,
      totalLop: payrollRuns.totalLop,
    })
      .from(payrollRuns)
      .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
      .limit(months)
  );

  // Employee counts per run
  const runIds = runs.map(r => r.id);
  const empCounts = runIds.length > 0
    ? await req.runInTenant!(async (db) =>
        db.select({ runId: payslips.payrollRunId, empCount: count() })
          .from(payslips)
          .where(inArray(payslips.payrollRunId, runIds))
          .groupBy(payslips.payrollRunId)
      )
    : [];

  const countByRun: Record<string, number> = {};
  for (const e of empCounts) countByRun[e.runId] = Number(e.empCount);

  const trend = runs.reverse().map(r => ({
    month: r.month,
    year: r.year,
    label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][r.month - 1]} ${r.year}`,
    status: r.status,
    grossPayroll: Math.round(parseFloat(r.totalGross || '0')),
    netPayroll: Math.round(parseFloat(r.totalNet || '0')),
    totalDeductions: Math.round(
      parseFloat(r.totalPfEmployee || '0') +
      parseFloat(r.totalEsicEmployee || '0') +
      parseFloat(r.totalPt || '0') +
      parseFloat(r.totalTds || '0') +
      parseFloat(r.totalLop || '0')
    ),
    pfCost: Math.round(parseFloat(r.totalPfEmployee || '0') + parseFloat(r.totalPfEmployer || '0')),
    esicCost: Math.round(parseFloat(r.totalEsicEmployee || '0') + parseFloat(r.totalEsicEmployer || '0')),
    employeeCount: countByRun[r.id] || 0,
  }));

  return res.json({ data: { trend, months } });
}

// ─── Salary Register ──────────────────────────────────────────────────────────
// GET /reports/salary-register
export async function getSalaryRegister(req: Request, res: Response) {
  const today = new Date().toISOString().split('T')[0];

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      employmentType: employees.employmentType,
      joiningDate: employees.joiningDate,
      deptName: departments.name,
      gross: employeeSalary.gross,
      effectiveFrom: employeeSalary.effectiveFrom,
      structureName: salaryStructures.name,
      basicPct: salaryStructures.basicPct,
    })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(
        employeeSalary,
        and(eq(employeeSalary.employeeId, employees.id), lte(employeeSalary.effectiveFrom, today))
      )
      .leftJoin(salaryStructures, eq(employeeSalary.structureId, salaryStructures.id))
      .where(eq(employees.status, 'ACTIVE'))
      .orderBy(departments.name, employees.firstName)
  );

  // Deduplicate: pick latest salary per employee
  const seen = new Set<string>();
  const data: any[] = [];
  for (const r of rows) {
    if (!seen.has(r.employeeCode)) {
      seen.add(r.employeeCode);
      const gross = parseFloat(r.gross || '0');
      const basicPct = parseFloat(String(r.basicPct || '50')) / 100;
      data.push({
        employeeCode: r.employeeCode,
        name: `${r.firstName} ${r.lastName}`,
        department: r.deptName || '—',
        employmentType: r.employmentType,
        joiningDate: r.joiningDate,
        grossSalary: gross,
        basic: Math.round(gross * basicPct),
        ctc: Math.round(gross * 1.12 + (gross <= 21000 ? gross * 0.0325 : 0)),
        structureName: r.structureName || 'Default',
        effectiveFrom: r.effectiveFrom || '—',
      });
    }
  }

  const totalGross = data.reduce((s, r) => s + r.grossSalary, 0);
  const totalCTC = data.reduce((s, r) => s + r.ctc, 0);

  return res.json({ data, summary: { employeeCount: data.length, totalGross: Math.round(totalGross), totalCTC: Math.round(totalCTC) } });
}

// ─── Attrition Report ────────────────────────────────────────────────────────
// GET /reports/attrition?year=2025
export async function getAttritionReport(req: Request, res: Response) {
  const year = parseInt(String(req.query.year)) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [joiners, leavers, allActive] = await Promise.all([
    req.runInTenant!(async (db) =>
      db.select({
        month: sql<string>`EXTRACT(MONTH FROM ${employees.joiningDate}::date)`,
        count: count(),
      })
        .from(employees)
        .where(and(gte(employees.joiningDate, yearStart), lte(employees.joiningDate, yearEnd)))
        .groupBy(sql`EXTRACT(MONTH FROM ${employees.joiningDate}::date)`)
    ),
    req.runInTenant!(async (db) =>
      db.select({
        month: sql<string>`EXTRACT(MONTH FROM ${employees.separationDate}::date)`,
        count: count(),
      })
        .from(employees)
        .where(and(
          gte(employees.separationDate, yearStart),
          lte(employees.separationDate, yearEnd),
          eq(employees.status, 'SEPARATED'),
        ))
        .groupBy(sql`EXTRACT(MONTH FROM ${employees.separationDate}::date)`)
    ),
    req.runInTenant!(async (db) =>
      db.select({ count: count() }).from(employees).where(eq(employees.status, 'ACTIVE'))
    ),
  ]);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthly = MONTH_NAMES.map((label, i) => {
    const m = String(i + 1);
    return {
      month: i + 1,
      label,
      joiners: Number(joiners.find(r => String(Math.round(Number(r.month))) === m)?.count || 0),
      leavers: Number(leavers.find(r => String(Math.round(Number(r.month))) === m)?.count || 0),
    };
  });

  const totalJoiners = monthly.reduce((s, m) => s + m.joiners, 0);
  const totalLeavers = monthly.reduce((s, m) => s + m.leavers, 0);
  const activeCount = Number(allActive[0]?.count || 0);
  const attritionRate = activeCount > 0 ? parseFloat(((totalLeavers / (activeCount + totalLeavers)) * 100).toFixed(1)) : 0;

  return res.json({
    data: {
      year, monthly, totalJoiners, totalLeavers, activeCount, attritionRate,
    }
  });
}

// ─── Late Arrivals Report ─────────────────────────────────────────────────────
// GET /reports/late-arrivals?month=6&year=2025
export async function getLateArrivalsReport(req: Request, res: Response) {
  const month = parseInt(String(req.query.month)) || new Date().getMonth() + 1;
  const year = parseInt(String(req.query.year)) || new Date().getFullYear();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      employeeId: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      employeeCode: employees.employeeCode,
      lateCount: count(attendanceLogs.id),
      totalLateMinutes: sql<string>`COALESCE(SUM(${attendanceLogs.lateByMinutes}), 0)`,
    })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .where(and(
        gte(attendanceLogs.date, from),
        lte(attendanceLogs.date, to),
        eq(attendanceLogs.isLate, true),
      ))
      .groupBy(employees.id, employees.firstName, employees.lastName, employees.employeeCode)
      .orderBy(desc(sql`COUNT(${attendanceLogs.id})`))
  );

  return res.json({
    data: rows.map(r => ({
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`,
      lateCount: Number(r.lateCount),
      totalLateMinutes: Math.round(Number(r.totalLateMinutes)),
    })),
    month, year,
  });
}

// ─── Overtime Report ──────────────────────────────────────────────────────────
// GET /reports/overtime?month=6&year=2025
export async function getOvertimeReport(req: Request, res: Response) {
  const month = parseInt(String(req.query.month)) || new Date().getMonth() + 1;
  const year = parseInt(String(req.query.year)) || new Date().getFullYear();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      employeeId: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      employeeCode: employees.employeeCode,
      totalOvertimeMinutes: sql<string>`COALESCE(SUM(${attendanceLogs.overtimeMinutes}), 0)`,
      overtimeDays: count(attendanceLogs.id),
    })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .where(and(
        gte(attendanceLogs.date, from),
        lte(attendanceLogs.date, to),
        sql`${attendanceLogs.overtimeMinutes} > 0`,
      ))
      .groupBy(employees.id, employees.firstName, employees.lastName, employees.employeeCode)
      .orderBy(desc(sql`SUM(${attendanceLogs.overtimeMinutes})`))
  );

  return res.json({
    data: rows.map(r => ({
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`,
      overtimeDays: Number(r.overtimeDays),
      totalOvertimeHours: parseFloat((Number(r.totalOvertimeMinutes) / 60).toFixed(2)),
    })),
    month, year,
  });
}

// ─── Department-wise Payroll Cost ─────────────────────────────────────────────
// GET /reports/dept-payroll?month=6&year=2025
export async function getDeptPayrollReport(req: Request, res: Response) {
  const parsed = { month: parseInt(String(req.query.month)), year: parseInt(String(req.query.year)) };
  if (!parsed.month || !parsed.year) return res.status(400).json({ error: 'Provide month and year' });

  const [run] = await req.runInTenant!(async (db) =>
    db.select().from(payrollRuns)
      .where(and(eq(payrollRuns.month, parsed.month), eq(payrollRuns.year, parsed.year)))
      .limit(1)
  );
  if (!run) return res.status(404).json({ error: 'No payroll run for this period' });

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      deptName: departments.name,
      headcount: count(payslips.id),
      totalGross: sql<string>`SUM(${payslips.earnedGross}::numeric)`,
      totalCTC: sql<string>`SUM(${payslips.grossSalary}::numeric)`,
    })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(payslips.payrollRunId, run.id))
      .groupBy(departments.name)
      .orderBy(desc(sql`SUM(${payslips.earnedGross}::numeric)`))
  );

  return res.json({
    data: rows.map(r => ({
      department: r.deptName || 'Unassigned',
      headcount: Number(r.headcount),
      totalGross: parseFloat(r.totalGross || '0'),
      totalCTC: parseFloat(r.totalCTC || '0'),
    })),
    month: parsed.month, year: parsed.year,
  });
}

// ─── New Joiners & Leavers Report ─────────────────────────────────────────────
// GET /reports/joiners-leavers?month=6&year=2025
export async function getJoinersLeaversReport(req: Request, res: Response) {
  const month = parseInt(String(req.query.month)) || new Date().getMonth() + 1;
  const year = parseInt(String(req.query.year)) || new Date().getFullYear();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [joiners, leavers] = await Promise.all([
    req.runInTenant!(async (db) =>
      db.select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        joiningDate: employees.joiningDate,
        designationId: employees.designationId,
        deptName: departments.name,
      })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(and(gte(employees.joiningDate, from), lte(employees.joiningDate, to)))
        .orderBy(employees.joiningDate)
    ),
    req.runInTenant!(async (db) =>
      db.select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        separationDate: employees.separationDate,
        designationId: employees.designationId,
        deptName: departments.name,
      })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(and(
          gte(employees.separationDate, from),
          lte(employees.separationDate, to),
          eq(employees.status, 'SEPARATED'),
        ))
        .orderBy(employees.separationDate)
    ),
  ]);

  return res.json({
    data: {
      joiners: joiners.map(e => ({
        employeeCode: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        joiningDate: e.joiningDate,
        designationId: e.designationId,
        department: e.deptName,
      })),
      leavers: leavers.map(e => ({
        employeeCode: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        separationDate: e.separationDate,
        designationId: e.designationId,
        department: e.deptName,
      })),
    },
    month, year,
  });
}
