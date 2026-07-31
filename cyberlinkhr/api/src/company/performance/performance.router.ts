import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin, requireManagerOrAbove } from '../../shared/middleware/rbac';
import {
  listCycles, createCycle, closeCycle,
  listSubmissions, getMySubmission, submitSelf, submitManagerReview,
} from './performance.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/cycles', listCycles);
router.post('/cycles', requireHRAdmin, createCycle);
router.patch('/cycles/:id/close', requireHRAdmin, closeCycle);

router.get('/submissions', requireManagerOrAbove, listSubmissions);
router.get('/submissions/mine/:cycleId', getMySubmission);
router.patch('/submissions/:id/self', submitSelf);
router.patch('/submissions/:id/manager', requireManagerOrAbove, submitManagerReview);

export default router;
