import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listPrograms, createProgram, updateProgramStatus,
  enrollEmployee, markComplete, listEnrollments, getMyTrainings,
} from './training.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listPrograms);
router.post('/', requireHRAdmin, createProgram);
router.patch('/:id/status', requireHRAdmin, updateProgramStatus);
router.post('/:id/enroll', requireHRAdmin, enrollEmployee);
router.patch('/enrollments/:enrollmentId/complete', requireHRAdmin, markComplete);
router.get('/:programId/enrollments', requireHRAdmin, listEnrollments);
router.get('/my', getMyTrainings);

export default router;
