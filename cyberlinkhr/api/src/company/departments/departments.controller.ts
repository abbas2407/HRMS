import { Request, Response } from 'express';
import { departments, employees } from '../../shared/db/tenant.schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getCache, setCache, deleteCache } from '../../shared/utils/redis';

const cacheKey = (schema: string) => `cache:${schema}:departments`;

const deptSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional().nullable(),
  headId: z.string().uuid().optional().nullable(),
});

export async function listDepartments(req: Request, res: Response) {
  const key = cacheKey(req.user!.schemaName);
  const cached = await getCache(key);
  if (cached) return res.json({ data: JSON.parse(cached) });

  const data = await req.runInTenant!(async (db) => {
    return db
      .select({
        id: departments.id,
        name: departments.name,
        parentId: departments.parentId,
        headId: departments.headId,
        createdAt: departments.createdAt,
        employeeCount: sql<number>`(
          SELECT COUNT(*) FROM employees e
          WHERE e.department_id = departments.id AND e.status = 'ACTIVE'
        )`,
      })
      .from(departments)
      .orderBy(departments.name);
  });
  await setCache(key, JSON.stringify(data), 300);
  return res.json({ data });
}

export async function createDepartment(req: Request, res: Response) {
  const parsed = deptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(departments).values(parsed.data).returning()
  );
  await deleteCache(cacheKey(req.user!.schemaName));
  return res.status(201).json({ data: row });
}

export async function updateDepartment(req: Request, res: Response) {
  const parsed = deptSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const [row] = await req.runInTenant!(async (db) =>
    db.update(departments).set(parsed.data).where(eq(departments.id, String(req.params.id))).returning()
  );
  if (!row) return res.status(404).json({ error: 'Department not found' });
  await deleteCache(cacheKey(req.user!.schemaName));
  return res.json({ data: row });
}

export async function deleteDepartment(req: Request, res: Response) {
  const id = String(req.params.id);
  const hasEmployees = await req.runInTenant!(async (db) => {
    const [r] = await db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(eq(employees.departmentId, id));
    return Number(r?.count) > 0;
  });

  if (hasEmployees) {
    return res.status(400).json({ error: 'Cannot delete department with active employees. Reassign them first.' });
  }

  await req.runInTenant!(async (db) => db.delete(departments).where(eq(departments.id, id)));
  await deleteCache(cacheKey(req.user!.schemaName));
  return res.json({ data: { message: 'Department deleted' } });
}
