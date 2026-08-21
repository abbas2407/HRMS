import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  getHeadcountReport, getAttendanceReport, getLeaveReport,
  getPayrollTrend, getSalaryRegister, getAttritionReport,
  getLateArrivalsReport, getOvertimeReport, getDeptPayrollReport, getJoinersLeaversReport,
  listSavedReports, createSavedReport, deleteSavedReport, runQueryBuilder,
} from './reports.controller';

const router = Router();
router.use(authenticate, resolveTenant, requireHRAdmin);

// Query Builder routes
router.get('/query-builder/saved', listSavedReports);
router.post('/query-builder/saved', createSavedReport);
router.delete('/query-builder/saved/:id', deleteSavedReport);
router.post('/query-builder/run', runQueryBuilder);

router.get('/headcount', getHeadcountReport);
router.get('/attendance', getAttendanceReport);
router.get('/leave', getLeaveReport);
router.get('/payroll-trend', getPayrollTrend);
router.get('/salary-register', getSalaryRegister);
router.get('/attrition', getAttritionReport);
router.get('/late-arrivals', getLateArrivalsReport);
router.get('/overtime', getOvertimeReport);
router.get('/dept-payroll', getDeptPayrollReport);
router.get('/joiners-leavers', getJoinersLeaversReport);

export default router;
