import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  createPayrollRun, listPayrollRuns, getPayrollRun, getRunPayslips,
  getPayslip, getMyPayslips, getMyPayslipById, lockPayrollRun, disbursePayrollRun, deletePayrollRun,
} from './payroll.controller';
import {
  listSalaryStructures, createSalaryStructure, updateSalaryStructure, deleteSalaryStructure,
  assignEmployeeSalary, getEmployeeSalaryHistory,
} from './salary-structures.controller';
import { hooksMiddleware } from '../../shared/middleware/hooks';

const router = Router();
router.use(authenticate, resolveTenant, hooksMiddleware);

// Salary structures
router.get('/structures', listSalaryStructures);
router.post('/structures', requireHRAdmin, createSalaryStructure);
router.put('/structures/:id', requireHRAdmin, updateSalaryStructure);
router.delete('/structures/:id', requireHRAdmin, deleteSalaryStructure);

// Employee salary
router.get('/employee-salary/:employeeId', requireHRAdmin, getEmployeeSalaryHistory);
router.post('/employee-salary/:employeeId', requireHRAdmin, assignEmployeeSalary);

// My payslips (employee self-service) — must be before /:id routes
router.get('/my-payslips', getMyPayslips);
router.get('/my-payslips/:id', getMyPayslipById);

// Payslip by ID (HR admin only)
router.get('/payslips/:id', requireHRAdmin, getPayslip);

// Payroll runs
router.get('/runs', requireHRAdmin, listPayrollRuns);
router.post('/runs', requireHRAdmin, createPayrollRun);
router.get('/runs/:id', requireHRAdmin, getPayrollRun);
router.get('/runs/:id/payslips', requireHRAdmin, getRunPayslips);
router.put('/runs/:id/lock', requireHRAdmin, lockPayrollRun);
router.put('/runs/:id/disburse', requireHRAdmin, disbursePayrollRun);
router.delete('/runs/:id', requireHRAdmin, deletePayrollRun);

export default router;
