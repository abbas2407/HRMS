import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  punchIn, punchOut, getMyToday, getMyAttendance,
  getLiveBoard, listAttendance, manualCorrect, getGeoReport, listSwipes, getMuster,
} from './attendance.controller';
import { hooksMiddleware } from '../../shared/middleware/hooks';

const router = Router();
router.use(authenticate, resolveTenant, hooksMiddleware);

router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);
router.get('/today', getMyToday);
router.get('/my', getMyAttendance);
router.get('/live', requireHRAdmin, getLiveBoard);
router.get('/swipes', requireHRAdmin, listSwipes);
router.get('/muster', requireHRAdmin, getMuster);
router.get('/geo-report', requireHRAdmin, getGeoReport);
router.get('/', requireHRAdmin, listAttendance);
router.put('/:id', requireHRAdmin, manualCorrect);

export default router;


