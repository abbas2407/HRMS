import { Router } from 'express';
import { authenticateVendor } from '../../shared/middleware/auth';
import { recordPayment, listPayments, getAuditLog } from '../tenants/vendor-tenants.controller';

const router = Router();
router.use(authenticateVendor);

router.get('/', listPayments);
router.post('/', recordPayment);
router.get('/audit-log', getAuditLog);

export default router;
