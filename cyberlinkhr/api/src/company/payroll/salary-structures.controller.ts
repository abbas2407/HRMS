import { Request, Response } from 'express';
import { salaryStructures, employeeSalary } from '../../shared/db/tenant.schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const structureSchema = z.object({
  name: z.string().min(1).max(100),
  basicPct: z.number().min(0).max(100).default(50),
  hraPct: z.number().min(0).max(100).default(20),
  specialPct: z.number().min(0).max(100).default(30),
  isActive: z.boolean().optional(),
});

export async function listSalaryStructures(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select().from(salaryStructures).orderBy(desc(salaryStructures.createdAt))
  );
  return res.json({ data });
}

export async function createSalaryStructure(req: Request, res: Response) {
  const parsed = structureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
  const { name, basicPct, hraPct, specialPct } = parsed.data;
  if (basicPct + hraPct + specialPct !== 100) {
    return res.status(400).json({ error: 'basicPct + hraPct + specialPct must equal 100' });
  }
  const [row] = await req.runInTenant!(async (db) =>
    db.insert(salaryStructures).values({
      name,
      basicPct: String(basicPct),
      hraPct: String(hraPct),
      specialPct: String(specialPct),
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateSalaryStructure(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = structureSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { name, basicPct, hraPct, specialPct, isActive } = parsed.data;
  if (basicPct !== undefined && hraPct !== undefined && specialPct !== undefined) {
    if (basicPct + hraPct + specialPct !== 100) {
      return res.status(400).json({ error: 'basicPct + hraPct + specialPct must equal 100' });
    }
  }
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (basicPct !== undefined) updates.basicPct = String(basicPct);
  if (hraPct !== undefined) updates.hraPct = String(hraPct);
  if (specialPct !== undefined) updates.specialPct = String(specialPct);
  if (isActive !== undefined) updates.isActive = isActive;
  const [row] = await req.runInTenant!(async (db) =>
    db.update(salaryStructures).set(updates).where(eq(salaryStructures.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
}

export async function deleteSalaryStructure(req: Request, res: Response) {
  const id = String(req.params.id);
  // Check if any employee salary references this structure
  const [inUse] = await req.runInTenant!(async (db) =>
    db.select({ id: employeeSalary.id }).from(employeeSalary).where(eq(employeeSalary.structureId, id)).limit(1)
  );
  if (inUse) return res.status(409).json({ error: 'Structure is in use by employee salary records' });
  await req.runInTenant!(async (db) => db.delete(salaryStructures).where(eq(salaryStructures.id, id)));
  return res.json({ data: { message: 'Deleted' } });
}

// Assign salary to employee
export async function assignEmployeeSalary(req: Request, res: Response) {
  const empId = String(req.params.employeeId);
  const parsed = z.object({
    gross: z.number().min(1),
    structureId: z.string().uuid().optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { gross, structureId, effectiveFrom, reason } = parsed.data;
  const [row] = await req.runInTenant!(async (db) =>
    db.insert(employeeSalary).values({
      employeeId: empId,
      gross: String(gross),
      structureId: structureId || null,
      effectiveFrom,
      reason,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function getEmployeeSalaryHistory(req: Request, res: Response) {
  const empId = String(req.params.employeeId);
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
      .where(eq(employeeSalary.employeeId, empId))
      .orderBy(desc(employeeSalary.effectiveFrom))
  );
  return res.json({ data });
}
