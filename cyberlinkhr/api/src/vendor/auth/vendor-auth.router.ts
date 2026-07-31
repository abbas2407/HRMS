import { Router } from 'express';
import { vendorLogin, vendorRefresh } from './vendor-auth.controller';
import { authRateLimit } from '../../shared/middleware/rateLimit';

const router = Router();
router.post('/login', authRateLimit, vendorLogin);
router.post('/refresh', vendorRefresh);
export default router;
