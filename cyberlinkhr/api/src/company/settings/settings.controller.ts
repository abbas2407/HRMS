import { Request, Response } from 'express';
import { companySettings, departments, designations, shifts, employees, users } from '../../shared/db/tenant.schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getCache, setCache, deleteCache } from '../../shared/utils/redis';

const ALLOWED_KEYS = new Set([
  'company_name', 'company_logo_url', 'state', 'timezone', 'currency',
  'week_off_days', 'financial_year_start', 'payroll_cutoff_day',
  'probation_days', 'notice_period_days', 'pan_number', 'tan_number',
  'pf_number', 'esic_number', 'gst_number', 'pt_number',
]);

const settingsCacheKey = (schema: string) => `cache:${schema}:settings`;

export async function getSettings(req: Request, res: Response) {
  const key = settingsCacheKey(req.user!.schemaName);
  const cached = await getCache(key);
  if (cached) return res.json({ data: JSON.parse(cached) });

  const rows = await req.runInTenant!(async (db) =>
    db.select().from(companySettings)
  );
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value || '';
  await setCache(key, JSON.stringify(settings), 300);
  return res.json({ data: settings });
}

export async function upsertSetting(req: Request, res: Response) {
  const parsed = z.object({ key: z.string(), value: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide key and value' });
  const { key, value } = parsed.data;
  if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: `Unknown setting key: ${key}` });

  const existing = await req.runInTenant!(async (db) =>
    db.select().from(companySettings).where(eq(companySettings.key, key)).limit(1)
  );
  if (existing.length > 0) {
    await req.runInTenant!(async (db) =>
      db.update(companySettings).set({ value, updatedAt: new Date() }).where(eq(companySettings.key, key))
    );
  } else {
    await req.runInTenant!(async (db) =>
      db.insert(companySettings).values({ key, value })
    );
  }
  await deleteCache(settingsCacheKey(req.user!.schemaName));
  return res.json({ data: { key, value } });
}

export async function bulkUpsertSettings(req: Request, res: Response) {
  const parsed = z.record(z.string()).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a key-value object' });

  const invalid = Object.keys(parsed.data).filter(k => !ALLOWED_KEYS.has(k));
  if (invalid.length) return res.status(400).json({ error: `Unknown keys: ${invalid.join(', ')}` });

  for (const [key, value] of Object.entries(parsed.data)) {
    const existing = await req.runInTenant!(async (db) =>
      db.select({ id: companySettings.id }).from(companySettings).where(eq(companySettings.key, key)).limit(1)
    );
    if (existing.length > 0) {
      await req.runInTenant!(async (db) =>
        db.update(companySettings).set({ value, updatedAt: new Date() }).where(eq(companySettings.key, key))
      );
    } else {
      await req.runInTenant!(async (db) =>
        db.insert(companySettings).values({ key, value })
      );
    }
  }
  await deleteCache(settingsCacheKey(req.user!.schemaName));
  return res.json({ data: parsed.data });
}

export async function importCompany(req: Request, res: Response) {
  const { departments: importedDepts, designations: importedDesigs, shifts: importedShifts, employees: importedEmps } = req.body;

  const result = await req.runInTenant!(async (db) => {
    // 1. Process Departments
    const deptMap = new Map<string, string>();
    const existingDepts = await db.select().from(departments);
    for (const d of existingDepts) {
      deptMap.set(d.name.toLowerCase(), d.id);
    }
    if (importedDepts && Array.isArray(importedDepts)) {
      for (const d of importedDepts) {
        if (d.name && !deptMap.has(d.name.toLowerCase())) {
          const [inserted] = await db.insert(departments).values({ name: d.name }).returning();
          if (inserted) {
            deptMap.set(d.name.toLowerCase(), inserted.id);
          }
        }
      }
    }

    // 2. Process Designations
    const desigMap = new Map<string, string>();
    const existingDesigs = await db.select().from(designations);
    for (const d of existingDesigs) {
      desigMap.set(d.name.toLowerCase(), d.id);
    }
    if (importedDesigs && Array.isArray(importedDesigs)) {
      for (const d of importedDesigs) {
        if (d.name && !desigMap.has(d.name.toLowerCase())) {
          const [inserted] = await db.insert(designations).values({
            name: d.name,
            grade: d.grade || 'L1',
            level: d.level || 1,
          }).returning();
          if (inserted) {
            desigMap.set(d.name.toLowerCase(), inserted.id);
          }
        }
      }
    }

    // 3. Process Shifts
    const shiftMap = new Map<string, string>();
    const existingShifts = await db.select().from(shifts);
    for (const s of existingShifts) {
      shiftMap.set(s.name.toLowerCase(), s.id);
    }
    if (importedShifts && Array.isArray(importedShifts)) {
      for (const s of importedShifts) {
        if (s.name && !shiftMap.has(s.name.toLowerCase())) {
          const [inserted] = await db.insert(shifts).values({
            name: s.name,
            startTime: s.startTime || '09:00',
            endTime: s.endTime || '18:00',
          }).returning();
          if (inserted) {
            shiftMap.set(s.name.toLowerCase(), inserted.id);
          }
        }
      }
    }

    // 4. Process Employees and User accounts
    let empCount = 0;
    const existingEmps = await db.select().from(employees);
    const existingEmails = new Set(existingEmps.map(e => e.email?.toLowerCase()).filter(Boolean));

    const totalEmpsCountRow = await db.select({ count: sql<number>`count(*)` }).from(employees);
    let nextNum = Number(totalEmpsCountRow[0]?.count ?? 0) + 1;

    if (importedEmps && Array.isArray(importedEmps)) {
      const passwordHash = await bcrypt.hash('Demo@123', 10);
      for (const e of importedEmps) {
        if (e.firstName && e.lastName && e.email) {
          const emailLower = e.email.toLowerCase();
          if (!existingEmails.has(emailLower)) {
            const employeeCode = `EMP-${String(nextNum++).padStart(3, '0')}`;
            const deptId = e.departmentName ? deptMap.get(e.departmentName.toLowerCase()) || null : null;
            const desigId = e.designationName ? desigMap.get(e.designationName.toLowerCase()) || null : null;

            const [emp] = await db.insert(employees).values({
              employeeCode,
              firstName: e.firstName,
              lastName: e.lastName,
              email: e.email,
              phone: e.phone || null,
              gender: e.gender || 'MALE',
              dob: e.dob || '1995-01-01',
              joiningDate: e.joiningDate || '2023-01-01',
              departmentId: deptId,
              designationId: desigId,
              employmentType: e.employmentType || 'FULL_TIME',
              workLocation: e.workLocation || 'Mumbai',
              status: 'ACTIVE',
            }).returning();

            if (emp) {
              await db.insert(users).values({
                employeeId: emp.id,
                email: emp.email!,
                passwordHash,
                role: e.role === 'MANAGER' ? 'MANAGER' : e.role === 'HR_ADMIN' ? 'HR_ADMIN' : 'EMPLOYEE',
              });
              empCount++;
            }
          }
        }
      }
    }

    // Get final totals
    const finalEmps = await db.select({ count: sql<number>`count(*)` }).from(employees);
    const finalDepts = await db.select({ count: sql<number>`count(*)` }).from(departments);
    const finalDesigs = await db.select({ count: sql<number>`count(*)` }).from(designations);

    return {
      importedEmployees: empCount,
      totalEmployees: Number(finalEmps[0]?.count ?? 0),
      totalDepartments: Number(finalDepts[0]?.count ?? 0),
      totalDesignations: Number(finalDesigs[0]?.count ?? 0),
    };
  });

  return res.status(201).json({
    data: {
      message: 'Company data imported successfully',
      ...result
    }
  });
}
