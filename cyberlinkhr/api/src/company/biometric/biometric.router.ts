import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listDevices, createDevice, testDevice, syncDeviceNow, getDeviceUsers,
  listEnrollments, enrollEmployee, deleteEnrollment,
} from './biometric.controller';

const router = Router();

router.use(authenticate, resolveTenant, requireHRAdmin);

router.get('/devices', listDevices);
router.post('/devices', createDevice);
router.post('/devices/:id/test', testDevice);
router.post('/devices/:id/sync', syncDeviceNow);
router.get('/devices/:id/users', getDeviceUsers);

router.get('/enrollments', listEnrollments);
router.post('/enroll', enrollEmployee);
router.delete('/enroll/:id', deleteEnrollment);

export default router;
