import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { getOrgChart } from './org-chart.controller';

const router = Router();
router.get('/', authenticate, resolveTenant, getOrgChart);
export default router;
