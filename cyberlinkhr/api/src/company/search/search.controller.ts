import { Request, Response } from 'express';
import { ilike, or, eq, desc } from 'drizzle-orm';
import {
  employees, payslips, payrollRuns, leaveRequests, leaveTypes,
  departments, designations, grievances
} from '../../shared/db/tenant.schema';
import { z } from 'zod';

export async function globalSearch(req: Request, res: Response) {
  const parsed = z.object({ q: z.string().min(1).max(100), limit: z.coerce.number().optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Provide q parameter' });
  const { q, limit = 5 } = parsed.data;
  const term = `%${q}%`;

  const results = await req.runInTenant!(async (db) => {
    // Employees
    const emps = await db
      .select({ id: employees.id, employeeCode: employees.employeeCode, firstName: employees.firstName, lastName: employees.lastName, email: employees.email })
      .from(employees)
      .where(or(ilike(employees.firstName, term), ilike(employees.lastName, term), ilike(employees.employeeCode, term), ilike(employees.email, term)))
      .limit(limit);

    // Payslips
    const pays = await db
      .select({ id: payslips.id, month: payrollRuns.month, year: payrollRuns.year, earnedGross: payslips.earnedGross, empFirstName: employees.firstName, empLastName: employees.lastName, employeeCode: employees.employeeCode })
      .from(payslips)
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(or(ilike(employees.firstName, term), ilike(employees.lastName, term), ilike(employees.employeeCode, term)))
      .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
      .limit(limit);

    // Leave requests
    const leaves = await db
      .select({ id: leaveRequests.id, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, status: leaveRequests.status, leaveTypeName: leaveTypes.name, empFirstName: employees.firstName, empLastName: employees.lastName, employeeCode: employees.employeeCode })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(or(ilike(employees.firstName, term), ilike(employees.lastName, term), ilike(leaveTypes.name, term)))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(limit);

    // Departments
    const depts = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(ilike(departments.name, term))
      .limit(limit);

    // Designations
    const desigs = await db
      .select({ id: designations.id, name: designations.name })
      .from(designations)
      .where(ilike(designations.name, term))
      .limit(limit);

    // Payroll runs
    const runs = await db
      .select({ id: payrollRuns.id, month: payrollRuns.month, year: payrollRuns.year, status: payrollRuns.status })
      .from(payrollRuns)
      .limit(limit);

    // Grievances
    const grieves = await db
      .select({ id: grievances.id, subject: grievances.subject, status: grievances.status })
      .from(grievances)
      .where(ilike(grievances.subject, term))
      .limit(limit);

    return { emps, pays, leaves, depts, desigs, runs, grieves };
  });

  return res.json({
    data: {
      employees: results.emps.map(e => ({
        doctype: 'Employee',
        id: e.id,
        title: `${e.firstName} ${e.lastName}`,
        subtitle: e.employeeCode,
        url: `/employees/${e.id}`,
      })),
      payslips: results.pays.map(p => ({
        doctype: 'Payslip',
        id: p.id,
        title: `${p.empFirstName} ${p.empLastName} — ${p.month}/${p.year}`,
        subtitle: `₹${parseFloat(p.earnedGross || '0').toLocaleString('en-IN')}`,
        url: `/payroll/payslips/${p.id}`,
      })),
      leaveRequests: results.leaves.map(l => ({
        doctype: 'Leave Request',
        id: l.id,
        title: `${l.empFirstName} ${l.empLastName} · ${l.leaveTypeName}`,
        subtitle: `${l.startDate} → ${l.endDate} · ${l.status}`,
        url: `/leaves`,
      })),
      departments: results.depts.map(d => ({
        doctype: 'Department',
        id: d.id,
        title: d.name,
        subtitle: 'Department',
        url: `/departments`,
      })),
      designations: results.desigs.map(d => ({
        doctype: 'Designation',
        id: d.id,
        title: d.name,
        subtitle: 'Designation',
        url: `/designations`,
      })),
      payrollRuns: results.runs.map(r => ({
        doctype: 'Payroll Run',
        id: r.id,
        title: `Payroll Run ${r.month}/${r.year}`,
        subtitle: r.status,
        url: `/payroll/${r.id}`,
      })),
      grievances: results.grieves.map(g => ({
        doctype: 'Grievance',
        id: g.id,
        title: g.subject,
        subtitle: g.status,
        url: `/grievances`,
      })),
    },
  });
}
