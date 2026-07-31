import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  getPFReport, getESICReport, getPTReport, getForm24Q,
  getNEFTFile, getForm16, getAvailableRuns,
} from './compliance.controller';

const router = Router();
router.use(authenticate, resolveTenant, requireHRAdmin);

router.get('/runs', getAvailableRuns);
router.get('/pf', getPFReport);
router.get('/esic', getESICReport);
router.get('/pt', getPTReport);
router.get('/form24q', getForm24Q);
router.get('/neft', getNEFTFile);
router.get('/form16', getForm16);

export default router;
