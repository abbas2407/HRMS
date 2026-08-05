import { Request, Response } from 'express';
import { eq, and, or, isNull, gte, desc } from 'drizzle-orm';
import { announcements, departments } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  targetType: z.enum(['ALL', 'DEPARTMENT']).default('ALL'),
  departmentId: z.string().uuid().optional(),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().optional(),
});

export async function listAnnouncements(req: Request, res: Response) {
  const now = new Date();

  const rows = await req.runInTenant!(async (db) => {
    return db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        targetType: announcements.targetType,
        departmentId: announcements.departmentId,
        departmentName: departments.name,
        isPinned: announcements.isPinned,
        expiresAt: announcements.expiresAt,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .leftJoin(departments, eq(announcements.departmentId, departments.id))
      .where(or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(50);
  });

  return res.json({ data: rows });
}

export async function createAnnouncement(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(announcements).values({
      title: d.title,
      body: d.body,
      targetType: d.targetType,
      departmentId: d.departmentId,
      isPinned: d.isPinned,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
      createdBy: req.user!.userId,
    }).returning()
  );

  return res.status(201).json({ data: row });
}

export async function updateAnnouncement(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;

  const [row] = await req.runInTenant!(async (db) =>
    db.update(announcements).set({
      title: d.title,
      body: d.body,
      targetType: d.targetType,
      departmentId: d.departmentId,
      isPinned: d.isPinned,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    }).where(eq(announcements.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
}

export async function deleteAnnouncement(req: Request, res: Response) {
  const { id } = req.params;
  await req.runInTenant!(async (db) =>
    db.delete(announcements).where(eq(announcements.id, id))
  );
  return res.json({ success: true });
}

export async function togglePin(req: Request, res: Response) {
  const { id } = req.params;
  const row = await req.runInTenant!(async (db) => {
    const [current] = await db.select({ isPinned: announcements.isPinned })
      .from(announcements).where(eq(announcements.id, id));
    if (!current) return null;
    const [updated] = await db.update(announcements)
      .set({ isPinned: !current.isPinned })
      .where(eq(announcements.id, id))
      .returning();
    return updated;
  });
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
}
