import { Request, Response } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import {
  letterTemplates, generatedLetters, employees, departments,
  designations, employeeSalary, companySettings,
} from '../../shared/db/tenant.schema';
import { sql } from 'drizzle-orm';

function pad(n: number) { return String(n).padStart(3, '0'); }

async function getEmployeeForLetter(runInTenant: Request['runInTenant'], employeeId: string) {
  const [emp] = await runInTenant!(async (db) =>
    db.select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      joiningDate: employees.joiningDate,
      separationDate: employees.separationDate,
      departmentName: departments.name,
      designationName: designations.name,
    })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(eq(employees.id, employeeId))
  );
  return emp;
}

async function getCompanyName(runInTenant: Request['runInTenant']): Promise<string> {
  const [row] = await runInTenant!(async (db) =>
    db.select({ value: companySettings.value }).from(companySettings)
      .where(eq(companySettings.key, 'company_name'))
  );
  return row?.value || 'Your Company';
}

async function getLatestSalary(runInTenant: Request['runInTenant'], employeeId: string): Promise<string> {
  const [row] = await runInTenant!(async (db) =>
    db.select({ gross: employeeSalary.gross }).from(employeeSalary)
      .where(eq(employeeSalary.employeeId, employeeId))
      .orderBy(desc(employeeSalary.effectiveFrom)).limit(1)
  );
  return row?.gross ? '₹' + Number(row.gross).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function mergeTemplate(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}

export async function listTemplates(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select().from(letterTemplates).where(eq(letterTemplates.isActive, true))
  );
  return res.json({ data: rows });
}

export async function updateTemplate(req: Request, res: Response) {
  const { id } = req.params;
  const { htmlBody, name } = req.body;
  if (!htmlBody) return res.status(400).json({ error: 'htmlBody required' });
  const [row] = await req.runInTenant!(async (db) =>
    db.update(letterTemplates).set({ htmlBody, name, updatedAt: new Date() })
      .where(eq(letterTemplates.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function generateLetter(req: Request, res: Response) {
  const { employeeId, templateId } = req.body;
  if (!employeeId || !templateId) return res.status(400).json({ error: 'employeeId and templateId required' });

  const [template] = await req.runInTenant!(async (db) =>
    db.select().from(letterTemplates).where(eq(letterTemplates.id, templateId))
  );
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const [emp, companyName, grossSalary] = await Promise.all([
    getEmployeeForLetter(req.runInTenant, employeeId),
    getCompanyName(req.runInTenant),
    getLatestSalary(req.runInTenant, employeeId),
  ]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const count = await req.runInTenant!(async (db) => {
    const [r] = await db.select({ c: sql<number>`count(*)` }).from(generatedLetters)
      .where(eq(generatedLetters.employeeId, employeeId));
    return Number(r?.c || 0);
  });

  const vars: Record<string, string> = {
    EMPLOYEE_NAME: `${emp.firstName} ${emp.lastName}`,
    FIRST_NAME: emp.firstName,
    EMPLOYEE_CODE: emp.employeeCode,
    DESIGNATION: emp.designationName || '—',
    DEPARTMENT: emp.departmentName || '—',
    JOINING_DATE: formatDate(emp.joiningDate),
    LAST_WORKING_DATE: formatDate(emp.separationDate),
    COMPANY_NAME: companyName,
    TODAY_DATE: formatDate(new Date().toISOString().split('T')[0]),
    GROSS_SALARY: grossSalary,
    REF_NUMBER: `${companyName.slice(0, 3).toUpperCase()}-${template.type.slice(0, 3)}-${new Date().getFullYear()}-${pad(count + 1)}`,
  };

  const mergedHtml = mergeTemplate(template.htmlBody, vars);

  const [letter] = await req.runInTenant!(async (db) =>
    db.insert(generatedLetters).values({
      employeeId,
      templateId,
      type: template.type,
      mergedHtml,
      generatedBy: req.user!.userId,
    }).returning({ id: generatedLetters.id, type: generatedLetters.type, generatedAt: generatedLetters.generatedAt })
  );

  return res.status(201).json({ data: { ...letter, mergedHtml } });
}

export async function listLetters(req: Request, res: Response) {
  const { employeeId } = req.query;
  const targetEmpId = (employeeId as string) || req.user?.employeeId;

  const rows = await req.runInTenant!(async (db) => {
    const q = db.select({
      id: generatedLetters.id,
      type: generatedLetters.type,
      generatedAt: generatedLetters.generatedAt,
      employeeId: generatedLetters.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      templateId: generatedLetters.templateId,
    })
      .from(generatedLetters)
      .leftJoin(employees, eq(generatedLetters.employeeId, employees.id))
      .orderBy(desc(generatedLetters.generatedAt));

    if (targetEmpId) {
      return q.where(eq(generatedLetters.employeeId, targetEmpId));
    }
    return q.limit(100);
  });

  return res.json({ data: rows });
}

export async function getLetter(req: Request, res: Response) {
  const { id } = req.params;
  const [letter] = await req.runInTenant!(async (db) =>
    db.select().from(generatedLetters).where(eq(generatedLetters.id, id))
  );
  if (!letter) return res.status(404).json({ error: 'Letter not found' });

  const role = req.user?.role;
  if (role === 'EMPLOYEE' && letter.employeeId !== req.user?.employeeId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json({ data: letter });
}
