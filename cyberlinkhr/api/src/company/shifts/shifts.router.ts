import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listShifts, createShift, updateShift, deleteShift, assignShift, getEmployeeShift } from './shifts.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listShifts);
router.get('/employee/:empId', getEmployeeShift);
router.post('/', requireHRAdmin, createShift);
router.put('/:id', requireHRAdmin, updateShift);
router.delete('/:id', requireHRAdmin, deleteShift);
router.post('/:id/assign', requireHRAdmin, assignShift);

export default router;
