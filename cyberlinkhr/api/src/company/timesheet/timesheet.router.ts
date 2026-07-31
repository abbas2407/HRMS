import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin, requireManagerOrAbove } from '../../shared/middleware/rbac';
import {
  listProjects, createProject, updateProject,
  getMyWeek, upsertEntry, submitWeek,
  getTeamTimesheets, getEmployeeWeekDetail, reviewWeek,
} from './timesheet.controller';

const router = Router();
router.use(authenticate, resolveTenant);

// Projects
router.get('/projects', listProjects);
router.post('/projects', requireHRAdmin, createProject);
router.patch('/projects/:id', requireHRAdmin, updateProject);

// Employee timesheet
router.get('/my-week', getMyWeek);
router.post('/entries', upsertEntry);
router.post('/submit', submitWeek);

// Manager / HR review
router.get('/team', requireManagerOrAbove, getTeamTimesheets);
router.get('/team/:employeeId', requireManagerOrAbove, getEmployeeWeekDetail);
router.patch('/team/:employeeId/review', requireManagerOrAbove, reviewWeek);

export default router;
