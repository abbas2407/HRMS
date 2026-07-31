import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin, requireManagerOrAbove } from '../../shared/middleware/rbac';
import { listClaims, getClaim, createClaim, submitClaim, reviewClaim, reimburseClaim } from './expenses.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', listClaims);
router.get('/:id', getClaim);
router.post('/', createClaim);
router.patch('/:id/submit', submitClaim);
router.patch('/:id/review', requireManagerOrAbove, reviewClaim);
router.patch('/:id/reimburse', requireHRAdmin, reimburseClaim);

export default router;
