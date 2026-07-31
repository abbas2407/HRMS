import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listNotifications, getUnreadCount, markRead, markAllRead, listAuditLogs } from './notifications.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.get('/audit-logs', requireHRAdmin, listAuditLogs);

export default router;
