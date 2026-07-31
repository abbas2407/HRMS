import { Request, Response } from 'express';
import { deviceTokens, notifications } from '../../shared/db/tenant.schema';
import { eq, and } from 'drizzle-orm';

// POST /api/devices/register
export async function registerDevice(req: Request, res: Response) {
  const { token, platform = 'expo' } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token required' });
  }

  await req.runInTenant!(async (db) => {
    await db.insert(deviceTokens)
      .values({ userId: req.user!.userId, token, platform })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId: req.user!.userId, updatedAt: new Date() },
      });
  });

  return res.status(201).json({ data: { registered: true } });
}

// DELETE /api/devices/unregister
export async function unregisterDevice(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  await req.runInTenant!(async (db) => {
    await db.delete(deviceTokens)
      .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, req.user!.userId)));
  });

  return res.json({ data: { unregistered: true } });
}

// GET /api/notifications
export async function listNotifications(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select().from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(notifications.createdAt)
      .limit(50)
  );
  return res.json({ data });
}

// PUT /api/notifications/:id/read
export async function markRead(req: Request, res: Response) {
  await req.runInTenant!(async (db) =>
    db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.userId)))
  );
  return res.json({ data: { ok: true } });
}
