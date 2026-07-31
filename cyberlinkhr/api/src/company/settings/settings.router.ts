import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { getSettings, upsertSetting, bulkUpsertSettings } from './settings.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', getSettings);
router.post('/', requireHRAdmin, upsertSetting);
router.put('/bulk', requireHRAdmin, bulkUpsertSettings);

export default router;
