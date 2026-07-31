import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listGrievances, getGrievance, createGrievance, updateStatus, addComment } from './grievances.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listGrievances);
router.get('/:id', getGrievance);
router.post('/', createGrievance);
router.patch('/:id/status', requireHRAdmin, updateStatus);
router.post('/:id/comments', addComment);

export default router;
