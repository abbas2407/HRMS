import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listDesignations, createDesignation, updateDesignation, deleteDesignation } from './designations.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listDesignations);
router.post('/', requireHRAdmin, createDesignation);
router.put('/:id', requireHRAdmin, updateDesignation);
router.delete('/:id', requireHRAdmin, deleteDesignation);

export default router;
