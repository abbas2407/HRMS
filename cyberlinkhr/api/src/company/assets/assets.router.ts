import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listAssets, createAsset, updateAsset,
  assignAsset, returnAsset, getEmployeeAssets,
} from './assets.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listAssets);
router.post('/', requireHRAdmin, createAsset);
router.put('/:id', requireHRAdmin, updateAsset);
router.post('/:id/assign', requireHRAdmin, assignAsset);
router.post('/:id/return', requireHRAdmin, returnAsset);
router.get('/employee/:employeeId', getEmployeeAssets);

export default router;
