import { Request, Response } from 'express';
import { ilike, or, eq, desc } from 'drizzle-orm';
import { employees, payslips, payrollRuns, leaveRequests, leaveTypes } from '../../shared/db/tenant.schema';
import { z } from 'zod';

export async function globalSearch(req: Request, res: Response) {
  const parsed = z.object({ q: z.string().min(1).max(100) }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide q parameter' });
  const { q } = parsed.data;
  const term = `%${q}%`;

  const [empRows, payslipRows, leaveRows] = await req.runInTenant!(async (db) => {
    const emps = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(employees)
      .where(
        or(
          ilike(employees.firstName, term),
          ilike(employees.lastName, term),
          ilike(employees.employeeCode, term),
        )
      )
      .limit(5);

    const pays = await db
      .select({
        id: payslips.id,
        month: payrollRuns.month,
        year: payrollRuns.year,
        earnedGross: payslips.earnedGross,
        empFirstName: employees.firstName,
        empLastName: employees.lastName,
        employeeCode: employees.employeeCode,
      })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(
        or(
          ilike(employees.firstName, term),
          ilike(employees.lastName, term),
          ilike(employees.employeeCode, term),
        )
      )
      .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
      .limit(5);

    const leaves = await db
      .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        status: leaveRequests.status,
        leaveTypeName: leaveTypes.name,
        empFirstName: employees.firstName,
        empLastName: employees.lastName,
        employeeCode: employees.employeeCode,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(
        or(
          ilike(employees.firstName, term),
          ilike(employees.lastName, term),
          ilike(employees.employeeCode, term),
          ilike(leaveTypes.name, term),
        )
      )
      .orderBy(desc(leaveRequests.createdAt))
      .limit(5);

    return [emps, pays, leaves];
  });

  return res.json({
    data: {
      employees: empRows.map(e => ({
        id: e.id,
        label: `${e.firstName} ${e.lastName}`,
        sub: e.employeeCode,
        href: `/employees/${e.id}`,
      })),
      payslips: payslipRows.map(p => ({
        id: p.id,
        label: `${p.empFirstName} ${p.empLastName} — ${p.month}/${p.year}`,
        sub: `₹${parseFloat(p.earnedGross || '0').toLocaleString('en-IN')}`,
        href: `/payroll/payslips/${p.id}`,
      })),
      leaveRequests: leaveRows.map(l => ({
        id: l.id,
        label: `${l.empFirstName} ${l.empLastName} · ${l.leaveTypeName}`,
        sub: `${l.startDate} → ${l.endDate} · ${l.status}`,
        href: `/leave`,
      })),
    },
  });
}
