import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listShifts, createShift, updateShift, deleteShift,
  assignShift, getEmployeeShift, getShiftRoster, listShiftNames,
} from './shifts.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/names', requireHRAdmin, listShiftNames);
router.get('/roster', requireHRAdmin, getShiftRoster);
router.get('/', listShifts);
router.post('/', requireHRAdmin, createShift);
router.put('/:id', requireHRAdmin, updateShift);
router.delete('/:id', requireHRAdmin, deleteShift);
router.post('/:id/assign', requireHRAdmin, assignShift);
router.get('/employee/:empId', getEmployeeShift);

export default router;
