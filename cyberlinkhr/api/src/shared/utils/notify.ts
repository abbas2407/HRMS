import { notifications, auditLogs } from '../db/tenant.schema';
import { emitToTenant } from './socket';

interface NotifyOptions {
  db: any;
  schemaName: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkPath?: string;
}

export async function notify(opts: NotifyOptions) {
  const { db, schemaName, userId, type, title, message, linkPath } = opts;
  const [row] = await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    linkPath: linkPath || null,
  }).returning();

  emitToTenant(schemaName, 'notification', row);
  return row;
}

interface AuditOptions {
  db: any;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
}

export async function audit(opts: AuditOptions) {
  const { db, ...values } = opts;
  await db.insert(auditLogs).values({
    userId: values.userId || null,
    userEmail: values.userEmail || null,
    userRole: values.userRole || null,
    action: values.action,
    entity: values.entity || null,
    entityId: values.entityId || null,
    details: values.details || null,
    ipAddress: values.ipAddress || null,
  });
}
