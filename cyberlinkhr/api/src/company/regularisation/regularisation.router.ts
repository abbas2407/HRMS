import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { createRequest, listRequests, approveRequest, rejectRequest } from './regularisation.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.post('/', createRequest);
router.get('/', listRequests);
router.put('/:id/approve', requireHRAdmin, approveRequest);
router.put('/:id/reject', requireHRAdmin, rejectRequest);

export default router;
