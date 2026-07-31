import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin, requireManagerOrAbove } from '../../shared/middleware/rbac';
import {
  listEmployees, createEmployee, getEmployee, updateEmployee,
  updateEmployeeStatus, getSalaryHistory, assignSalary, getEmployeeStats, setGeoExempt,
  bulkImportEmployees, uploadCsvMiddleware,
} from './employees.controller';
import { getEmployeeTimeline } from '../documents/documents.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/stats', getEmployeeStats);
router.get('/', listEmployees);
router.post('/', requireHRAdmin, createEmployee);
router.post('/bulk-import', requireHRAdmin, uploadCsvMiddleware, bulkImportEmployees);
router.get('/:id', getEmployee);
router.put('/:id', requireHRAdmin, updateEmployee);
router.put('/:id/status', requireHRAdmin, updateEmployeeStatus);
router.get('/:id/salary', requireHRAdmin, getSalaryHistory);
router.post('/:id/salary', requireHRAdmin, assignSalary);
router.get('/:id/timeline', getEmployeeTimeline);
router.patch('/:id/geo-exempt', requireHRAdmin, setGeoExempt);

export default router;
