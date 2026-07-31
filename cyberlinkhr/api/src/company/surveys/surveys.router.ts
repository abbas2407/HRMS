import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listSurveys, getSurvey, createSurvey, updateStatus, submitResponse, getAnalytics } from './surveys.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listSurveys);
router.get('/:id', getSurvey);
router.post('/', requireHRAdmin, createSurvey);
router.patch('/:id/status', requireHRAdmin, updateStatus);
router.post('/:id/respond', submitResponse);
router.get('/:id/analytics', requireHRAdmin, getAnalytics);

export default router;
