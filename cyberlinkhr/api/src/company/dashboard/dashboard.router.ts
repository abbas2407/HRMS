import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { getDashboard } from './dashboard.controller';

const router = Router();
router.get('/', authenticate, resolveTenant, getDashboard);
export default router;
