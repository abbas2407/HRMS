import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin, requireManagerOrAbove } from '../../shared/middleware/rbac';
import { auditMiddleware } from '../../shared/middleware/audit';
import { hooksMiddleware } from '../../shared/middleware/hooks';
import {
  listEmployees, createEmployee, getEmployee, updateEmployee, deleteEmployee,
  updateEmployeeStatus, getSalaryHistory, assignSalary, getEmployeeStats, setGeoExempt,
  bulkImportEmployees, uploadCsvMiddleware, getMyEmployee, updateMyEmployee,
} from './employees.controller';
import { getEmployeeTimeline } from '../documents/documents.controller';

const router = Router();
router.use(authenticate, resolveTenant, auditMiddleware, hooksMiddleware);

router.get('/stats', getEmployeeStats);
router.get('/me', getMyEmployee);
router.patch('/me', updateMyEmployee);
router.get('/', listEmployees);
router.post('/', requireHRAdmin, createEmployee);
router.post('/bulk-import', requireHRAdmin, uploadCsvMiddleware, bulkImportEmployees);
router.get('/:id', getEmployee);
router.put('/:id', requireHRAdmin, updateEmployee);
router.delete('/:id', requireHRAdmin, deleteEmployee);
router.put('/:id/status', requireHRAdmin, updateEmployeeStatus);
router.get('/:id/salary', requireHRAdmin, getSalaryHistory);
router.post('/:id/salary', requireHRAdmin, assignSalary);
router.get('/:id/timeline', getEmployeeTimeline);
router.patch('/:id/geo-exempt', requireHRAdmin, setGeoExempt);

export default router;
