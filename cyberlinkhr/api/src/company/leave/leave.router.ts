import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from './leave-types.controller';
import { getLeaveBalance, creditLeave, accrueLeave } from './leave-balance.controller';
import {
  createLeaveRequest, listLeaveRequests,
  approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest,
} from './leave-request.controller';
import {
  listHolidays, createHoliday, bulkCreateHolidays,
  updateHoliday, deleteHoliday, seedNationalHolidays,
} from './holidays.controller';

const router = Router();
router.use(authenticate, resolveTenant);

// Leave types
router.get('/types', listLeaveTypes);
router.post('/types', requireHRAdmin, createLeaveType);
router.put('/types/:id', requireHRAdmin, updateLeaveType);
router.delete('/types/:id', requireHRAdmin, deleteLeaveType);

// Leave balance
router.get('/balance', getLeaveBalance);
router.post('/balance/credit', requireHRAdmin, creditLeave);
router.post('/balance/accrue', requireHRAdmin, accrueLeave);

// Leave requests
router.post('/requests', createLeaveRequest);
router.get('/requests', listLeaveRequests);
router.put('/requests/:id/approve', requireHRAdmin, approveLeaveRequest);
router.put('/requests/:id/reject', requireHRAdmin, rejectLeaveRequest);
router.put('/requests/:id/cancel', cancelLeaveRequest);

// Holidays
router.get('/holidays', listHolidays);
router.post('/holidays', requireHRAdmin, createHoliday);
router.post('/holidays/bulk', requireHRAdmin, bulkCreateHolidays);
router.post('/holidays/seed-national', requireHRAdmin, seedNationalHolidays);
router.put('/holidays/:id', requireHRAdmin, updateHoliday);
router.delete('/holidays/:id', requireHRAdmin, deleteHoliday);

export default router;
