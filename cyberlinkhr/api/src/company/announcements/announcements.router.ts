import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listAnnouncements, createAnnouncement, deleteAnnouncement, togglePin,
} from './announcements.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listAnnouncements);
router.post('/', requireHRAdmin, createAnnouncement);
router.delete('/:id', requireHRAdmin, deleteAnnouncement);
router.patch('/:id/pin', requireHRAdmin, togglePin);

export default router;
