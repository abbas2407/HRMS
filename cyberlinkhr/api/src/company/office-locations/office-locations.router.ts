import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listLocations, createLocation, updateLocation, deleteLocation } from './office-locations.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listLocations);
router.post('/', requireHRAdmin, createLocation);
router.put('/:id', requireHRAdmin, updateLocation);
router.delete('/:id', requireHRAdmin, deleteLocation);

export default router;
