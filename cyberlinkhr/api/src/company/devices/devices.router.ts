import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { registerDevice, unregisterDevice, listNotifications, markRead } from './devices.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.post('/register', registerDevice);
router.delete('/unregister', unregisterDevice);
router.get('/notifications', listNotifications);
router.put('/notifications/:id/read', markRead);

export default router;
