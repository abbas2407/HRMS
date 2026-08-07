import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  employees, departments, designations,
  users, employeeSalary, salaryStructures, documents, employeeAuditLog,
} from '../../shared/db/tenant.schema';
import { eq, and, ilike, or, sql, desc, ne } from 'drizzle-orm';
import { encrypt, decrypt, maskValue } from '../../shared/utils/crypto';
import { z } from 'zod';

// Auto-generate EMP-001 style codes using MAX to avoid count-based race conditions.
// The UNIQUE constraint on employee_code is the final safety net.
async function nextEmployeeCode(run: Request['runInTenant']): Promise<string> {
  const [r] = await run!(async (db) =>
    db.select({ max: sql<string | null>`MAX(employee_code)` }).from(employees)
  );
  const last = r?.max; // e.g. "EMP-042" or null
  let n = 1;
  if (last) {
    const match = last.match(/(\d+)$/);
    if (match) n = parseInt(match[1], 10) + 1;
  }
  return `EMP-${String(n).padStart(3, '0')}`;
}

const validatePhone = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^(?:(?:\+91|91|0)?[6-9]\d{9}|\+?[1-9]\d{9,14})$/, 'Invalid phone number format. Must be a valid Indian (+91) or international number.').optional()
);

const validateUan = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^\d{12}$/, 'UAN must be exactly 12 digits').optional()
);

const validateEsicIp = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^\d{17}$/, 'ESIC IP Number must be exactly 17 digits').optional()
);

const validatePan = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, 'Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F).').transform(v => v?.toUpperCase()).optional()
);

const validateAadhaar = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^[2-9]\d{3}\s?\d{4}\s?\d{4}$|^[2-9]\d{11}$/, 'Invalid Aadhaar format. Must be a 12-digit number (e.g., 200012345678) starting with 2-9.').optional()
);

const validateBankAccount = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^\d{9,18}$/, 'Bank account must be between 9 and 18 digits.').optional()
);

const validateIfsc = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC format. Must be 11 characters (e.g., SBIN0001234).').transform(v => v?.toUpperCase()).optional()
);

const createSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: validatePhone,
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  joiningDate: z.string(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  workLocation: z.string().optional(),
  grade: z.string().optional(),
  costCentre: z.string().optional(),
  uanNumber: validateUan,
  esicIpNumber: validateEsicIp,
  panNumber: validatePan,
  aadhaarNumber: validateAadhaar,
  bankAccount: validateBankAccount,
  bankIfsc: validateIfsc,
  bankName: z.string().optional(),
  grossSalary: z.number().positive().optional(),
  salaryStructureId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial().omit({ joiningDate: true }).extend({
  joiningDate: z.string().optional(),
  confirmationDate: z.string().optional(),
});

// GET /employees
export async function listEmployees(req: Request, res: Response) {
  const { search, departmentId, status = 'ACTIVE', page = '1', limit = '25' } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const [rows, [countRow]] = await req.runInTenant!(async (db) => {
    const conditions: any[] = [];

    if (status) conditions.push(eq(employees.status, status as any));
    if (departmentId) conditions.push(eq(employees.departmentId, departmentId));
    if (search) {
      conditions.push(or(
        ilike(employees.firstName, `%${search}%`),
        ilike(employees.lastName, `%${search}%`),
        ilike(employees.employeeCode, `%${search}%`),
        ilike(employees.email, `%${search}%`),
      )!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, count] = await Promise.all([
      db.select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
        status: employees.status,
        employmentType: employees.employmentType,
        joiningDate: employees.joiningDate,
        workLocation: employees.workLocation,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        designationId: employees.designationId,
        designationName: designations.name,
        createdAt: employees.createdAt,
      })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(where)
        .orderBy(employees.employeeCode)
        .limit(Number(limit))
        .offset(offset),

      db.select({ count: sql<number>`count(*)` })
        .from(employees)
        .where(where),
    ]);

    return [data, count];
  });

  return res.json({
    data: rows,
    meta: { total: Number(countRow?.count ?? 0), page: Number(page), limit: Number(limit) },
  });
}

// POST /employees
export async function createEmployee(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const d = parsed.data;

  // Retry once on unique constraint collision (two concurrent requests racing on MAX)
  let employeeCode = await nextEmployeeCode(req.runInTenant);
  let row: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      row = await req.runInTenant!(async (db) => {
        const [emp] = await db.insert(employees).values({
          employeeCode,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          phone: d.phone,
          dob: d.dob || null,
          gender: d.gender,
          departmentId: d.departmentId,
          designationId: d.designationId,
          managerId: d.managerId,
          joiningDate: d.joiningDate,
          employmentType: d.employmentType,
          workLocation: d.workLocation,
          grade: d.grade,
          costCentre: d.costCentre,
          uanNumber: d.uanNumber,
          esicIpNumber: d.esicIpNumber,
          panNumber: d.panNumber ? encrypt(d.panNumber) : null,
          aadhaarNumber: d.aadhaarNumber ? encrypt(d.aadhaarNumber) : null,
          bankAccount: d.bankAccount ? encrypt(d.bankAccount) : null,
          bankIfsc: d.bankIfsc,
          bankName: d.bankName,
        }).returning();

        if (d.email && emp) {
          const passwordHash = await bcrypt.hash('Welcome@123', 10);
          await db.insert(users).values({
            employeeId: emp.id,
            email: d.email,
            passwordHash,
            role: 'EMPLOYEE',
          });
        }

        if (d.grossSalary && emp) {
          await db.insert(employeeSalary).values({
            employeeId: emp.id,
            structureId: d.salaryStructureId,
            gross: String(d.grossSalary),
            effectiveFrom: d.joiningDate,
            reason: 'Initial salary assignment',
          });
        }

        return emp;
      });
      break; // success
    } catch (err: any) {
      const isUniqueViolation = err?.code === '23505' && err?.constraint?.includes('employee_code');
      if (isUniqueViolation && attempt === 0) {
        employeeCode = await nextEmployeeCode(req.runInTenant);
        continue;
      }
      throw err;
    }
  }

  return res.status(201).json({ data: row });
}

// GET /employees/:id
export async function getEmployee(req: Request, res: Response) {
  const id = String(req.params.id);

  const data = await req.runInTenant!(async (db) => {
    const [emp] = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
        dob: employees.dob,
        gender: employees.gender,
        panNumber: employees.panNumber,
        aadhaarNumber: employees.aadhaarNumber,
        bankAccount: employees.bankAccount,
        bankIfsc: employees.bankIfsc,
        bankName: employees.bankName,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        designationId: employees.designationId,
        designationName: designations.name,
        managerId: employees.managerId,
        grade: employees.grade,
        costCentre: employees.costCentre,
        joiningDate: employees.joiningDate,
        confirmationDate: employees.confirmationDate,
        separationDate: employees.separationDate,
        employmentType: employees.employmentType,
        workLocation: employees.workLocation,
        status: employees.status,
        uanNumber: employees.uanNumber,
        esicIpNumber: employees.esicIpNumber,
        isGeoExempt: employees.isGeoExempt,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(eq(employees.id, id))
      .limit(1);

    if (!emp) return null;

    const [currentSalary] = await db
      .select({ gross: employeeSalary.gross, effectiveFrom: employeeSalary.effectiveFrom, structureId: employeeSalary.structureId })
      .from(employeeSalary)
      .where(eq(employeeSalary.employeeId, id))
      .orderBy(desc(employeeSalary.effectiveFrom))
      .limit(1);

    const [docCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(eq(documents.employeeId, id), eq(documents.isDeleted, false)));

    // Mask sensitive fields
    return {
      ...emp,
      panNumber: emp.panNumber ? maskValue(decrypt(emp.panNumber), 4) : null,
      aadhaarNumber: emp.aadhaarNumber ? maskValue(decrypt(emp.aadhaarNumber), 4) : null,
      bankAccount: emp.bankAccount ? maskValue(decrypt(emp.bankAccount), 4) : null,
      currentGross: currentSalary?.gross ?? null,
      currentSalaryFrom: currentSalary?.effectiveFrom ?? null,
      documentCount: Number(docCount?.count ?? 0),
    };
  });

  if (!data) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ data });
}

// PUT /employees/:id
export async function updateEmployee(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const d = parsed.data;
  const updates: Record<string, any> = {
    ...d,
    updatedAt: new Date(),
  };

  if (d.panNumber) updates.panNumber = encrypt(d.panNumber);
  if (d.aadhaarNumber) updates.aadhaarNumber = encrypt(d.aadhaarNumber);
  if (d.bankAccount) updates.bankAccount = encrypt(d.bankAccount);

  const [row] = await req.runInTenant!(async (db) =>
    db.update(employees).set(updates).where(eq(employees.id, id)).returning()
  );

  if (!row) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ data: row });
}

// PUT /employees/:id/status
export async function updateEmployeeStatus(req: Request, res: Response) {
  const id = String(req.params.id);
  const { status, separationDate, reason } = req.body;
  const allowed = ['ACTIVE', 'INACTIVE', 'SEPARATED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const updates: any = { status, updatedAt: new Date() };
  if (status === 'SEPARATED' && separationDate) updates.separationDate = separationDate;

  const [row] = await req.runInTenant!(async (db) => {
    const result = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    if (result[0] && req.user) {
      await db.insert(employeeAuditLog).values({
        employeeId: id,
        changeType: 'STATUS_CHANGE',
        fieldName: 'status',
        oldValue: result[0]?.status,
        newValue: status,
        changedBy: req.user!.userId,
      });
    }
    return result;
  });

  if (!row) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ data: row });
}

// GET /employees/:id/salary
export async function getSalaryHistory(req: Request, res: Response) {
  const id = String(req.params.id);
  const data = await req.runInTenant!(async (db) =>
    db.select({
      id: employeeSalary.id,
      gross: employeeSalary.gross,
      effectiveFrom: employeeSalary.effectiveFrom,
      reason: employeeSalary.reason,
      createdAt: employeeSalary.createdAt,
      structureName: salaryStructures.name,
    })
      .from(employeeSalary)
      .leftJoin(salaryStructures, eq(employeeSalary.structureId, salaryStructures.id))
      .where(eq(employeeSalary.employeeId, id))
      .orderBy(desc(employeeSalary.effectiveFrom))
  );
  return res.json({ data });
}

// POST /employees/:id/salary
export async function assignSalary(req: Request, res: Response) {
  const id = String(req.params.id);
  const schema = z.object({
    gross: z.number().positive(),
    effectiveFrom: z.string(),
    structureId: z.string().uuid().optional(),
    reason: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(employeeSalary).values({
      employeeId: id,
      gross: String(parsed.data.gross),
      effectiveFrom: parsed.data.effectiveFrom,
      structureId: parsed.data.structureId,
      reason: parsed.data.reason,
    }).returning()
  );

  return res.status(201).json({ data: row });
}

// DELETE /employees/:id
export async function deleteEmployee(req: Request, res: Response) {
  const id = String(req.params.id);
  const [deleted] = await req.runInTenant!(async (db) =>
    db.delete(employees).where(eq(employees.id, id)).returning({ id: employees.id })
  );
  if (!deleted) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ success: true });
}

// PATCH /employees/:id/geo-exempt
export async function setGeoExempt(req: Request, res: Response) {
  const id = String(req.params.id);
  const { isGeoExempt } = req.body;
  if (typeof isGeoExempt !== 'boolean') return res.status(400).json({ error: 'isGeoExempt must be boolean' });

  const [row] = await req.runInTenant!(async (db) =>
    db.update(employees).set({ isGeoExempt, updatedAt: new Date() }).where(eq(employees.id, id)).returning({
      id: employees.id, firstName: employees.firstName, lastName: employees.lastName,
      employeeCode: employees.employeeCode, isGeoExempt: employees.isGeoExempt,
    })
  );
  if (!row) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ data: row });
}

// GET /employees/stats (dashboard)
export async function getEmployeeStats(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) => {
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(employees);
    const [active] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.status, 'ACTIVE'));
    const [inactive] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.status, 'INACTIVE'));
    const [separated] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.status, 'SEPARATED'));
    return {
      total: Number(total?.count ?? 0),
      active: Number(active?.count ?? 0),
      inactive: Number(inactive?.count ?? 0),
      separated: Number(separated?.count ?? 0),
    };
  });
  return res.json({ data });
}

// POST /employees/bulk-import  (multipart/form-data, field: file, CSV)
// Expected CSV headers: firstName,lastName,email,phone,gender,dob,joiningDate,departmentId,designationId,employmentType,workLocation
import multer from 'multer';
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadCsvMiddleware = csvUpload.single('file');

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

export async function bulkImportEmployees(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const rows = parseCSV(req.file.buffer.toString('utf-8'));
  if (!rows.length) return res.status(400).json({ error: 'Empty or invalid CSV' });

  const results: { row: number; status: 'created' | 'error'; employeeCode?: string; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.firstName || !row.lastName || !row.joiningDate) {
        results.push({ row: i + 2, status: 'error', error: 'firstName, lastName, joiningDate are required' });
        continue;
      }

      const code = await nextEmployeeCode(req.runInTenant);
      const [emp] = await req.runInTenant!(async (db) =>
        db.insert(employees).values({
          employeeCode: code,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email || null,
          phone: row.phone || null,
          gender: (row.gender as any) || null,
          dob: row.dob || null,
          joiningDate: row.joiningDate,
          departmentId: row.departmentId || null,
          designationId: row.designationId || null,
          employmentType: (row.employmentType as any) || 'FULL_TIME',
          workLocation: row.workLocation || null,
          status: 'ACTIVE',
        }).returning({ id: employees.id, employeeCode: employees.employeeCode })
      );
      results.push({ row: i + 2, status: 'created', employeeCode: emp.employeeCode });
    } catch (err: any) {
      results.push({ row: i + 2, status: 'error', error: err?.message || 'Unknown error' });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const failed = results.filter(r => r.status === 'error').length;
  return res.status(201).json({ data: { created, failed, results } });
}
