import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listDepartments, createDepartment, updateDepartment, deleteDepartment } from './departments.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listDepartments);
router.post('/', requireHRAdmin, createDepartment);
router.put('/:id', requireHRAdmin, updateDepartment);
router.delete('/:id', requireHRAdmin, deleteDepartment);

export default router;
