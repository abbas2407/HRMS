import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  createPayrollRun, listPayrollRuns, getPayrollRun, getRunPayslips,
  getPayslip, getMyPayslips, getMyPayslipById, lockPayrollRun, disbursePayrollRun, deletePayrollRun,
  listPayrollProcessLogs, getEmployeeSalaryDetails, processEmployeePayroll,
  listFinalSettlements, createFinalSettlement, toggleLockFinalSettlement, deleteFinalSettlement,
  listStopSalaryProcessing, createStopSalaryProcessing, deleteStopSalaryProcessing,
} from './payroll.controller';
import {
  listSalaryStructures, createSalaryStructure, updateSalaryStructure, deleteSalaryStructure,
  assignEmployeeSalary, getEmployeeSalaryHistory,
} from './salary-structures.controller';
import { hooksMiddleware } from '../../shared/middleware/hooks';

const router = Router();
router.use(authenticate, resolveTenant, hooksMiddleware);

// Final Settlement
router.get('/final-settlements', requireHRAdmin, listFinalSettlements);
router.post('/final-settlements', requireHRAdmin, createFinalSettlement);
router.put('/final-settlements/:id/lock', requireHRAdmin, toggleLockFinalSettlement);
router.delete('/final-settlements/:id', requireHRAdmin, deleteFinalSettlement);

// Stop Salary
router.get('/stop-salary', requireHRAdmin, listStopSalaryProcessing);
router.post('/stop-salary', requireHRAdmin, createStopSalaryProcessing);
router.delete('/stop-salary/:id', requireHRAdmin, deleteStopSalaryProcessing);

// Salary structures
router.get('/structures', listSalaryStructures);
router.post('/structures', requireHRAdmin, createSalaryStructure);
router.put('/structures/:id', requireHRAdmin, updateSalaryStructure);
router.delete('/structures/:id', requireHRAdmin, deleteSalaryStructure);

// Employee salary
router.get('/employee-salary-detail', requireHRAdmin, getEmployeeSalaryDetails);
router.get('/employee-salary/:employeeId', requireHRAdmin, getEmployeeSalaryHistory);
router.post('/employee-salary/:employeeId', requireHRAdmin, assignEmployeeSalary);

// Process & logs
router.get('/process-logs', requireHRAdmin, listPayrollProcessLogs);
router.post('/process-employee', requireHRAdmin, processEmployeePayroll);

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
