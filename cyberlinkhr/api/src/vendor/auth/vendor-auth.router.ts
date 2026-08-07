import { Router } from 'express';
import { vendorLogin, vendorLogout, vendorRefresh } from './vendor-auth.controller';
import { authenticateVendor } from '../../shared/middleware/auth';
import { authRateLimit } from '../../shared/middleware/rateLimit';

const router = Router();
router.post('/login', authRateLimit, vendorLogin);
router.post('/logout', authenticateVendor, vendorLogout);
router.post('/refresh', vendorRefresh);
export default router;
