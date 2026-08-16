import { Request, Response } from 'express';
import { eq, desc, isNull, and, count } from 'drizzle-orm';
import { notifications, auditLogs, users, leaveRequests, regularisationRequests } from '../../shared/db/tenant.schema';
import { audit } from '../../shared/utils/notify';

export async function listNotifications(req: Request, res: Response) {
  const userId = req.user!.userId;

  const rows = await req.runInTenant!(async (db) =>
    db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
  );
  return res.json({ data: rows });
}

export async function getUnreadCount(req: Request, res: Response) {
  const userId = req.user!.userId;
  const role = req.user!.role;

  const result = await req.runInTenant!(async (db) => {
    const [{ total }] = await db.select({ total: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    
    let pendingActions = 0;
    if (['HR_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
      const [{ pendingLeaves }] = await db.select({ pendingLeaves: count() }).from(leaveRequests)
        .where(eq(leaveRequests.status as any, 'PENDING'));
      const [{ pendingRegs }] = await db.select({ pendingRegs: count() }).from(regularisationRequests)
        .where(eq(regularisationRequests.status as any, 'PENDING'));
      pendingActions = Number(pendingLeaves || 0) + Number(pendingRegs || 0);
    }

    return Number(total || 0) + pendingActions;
  });
  return res.json({ data: { count: result } });
}

export async function markRead(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  await req.runInTenant!(async (db) =>
    db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
  );
  return res.json({ data: { ok: true } });
}

export async function markAllRead(req: Request, res: Response) {
  const userId = req.user!.userId;
  await req.runInTenant!(async (db) =>
    db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  );
  return res.json({ data: { ok: true } });
}

export async function listAuditLogs(req: Request, res: Response) {
  const { entity, action, limit = '100' } = req.query;

  const rows = await req.runInTenant!(async (db) => {
    let q = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Number(limit));
    return q;
  });

  const filtered = rows.filter((r: any) => {
    if (entity && r.entity !== entity) return false;
    if (action && !r.action.toLowerCase().includes((action as string).toLowerCase())) return false;
    return true;
  });

  return res.json({ data: filtered });
}
