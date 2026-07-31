import { Request, Response } from 'express';
import { designations, employees } from '../../shared/db/tenant.schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(200),
  grade: z.string().max(50).optional().nullable(),
  level: z.number().int().min(1).optional(),
});

export async function listDesignations(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select().from(designations).orderBy(designations.level, designations.name)
  );
  return res.json({ data });
}

export async function createDesignation(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(designations).values(parsed.data).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateDesignation(req: Request, res: Response) {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const [row] = await req.runInTenant!(async (db) =>
    db.update(designations).set(parsed.data).where(eq(designations.id, String(req.params.id))).returning()
  );
  if (!row) return res.status(404).json({ error: 'Designation not found' });
  return res.json({ data: row });
}

export async function deleteDesignation(req: Request, res: Response) {
  const id = String(req.params.id);
  const used = await req.runInTenant!(async (db) => {
    const [r] = await db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(eq(employees.designationId, id));
    return Number(r?.count) > 0;
  });

  if (used) return res.status(400).json({ error: 'Cannot delete designation assigned to employees.' });

  await req.runInTenant!(async (db) => db.delete(designations).where(eq(designations.id, id)));
  return res.json({ data: { message: 'Designation deleted' } });
}
