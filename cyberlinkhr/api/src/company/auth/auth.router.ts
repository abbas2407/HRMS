import { Router } from 'express';
import { login, refresh, logout, forgotPassword, resetPassword, changePassword } from './auth.controller';
import { authenticate } from '../../shared/middleware/auth';
import { authRateLimit } from '../../shared/middleware/rateLimit';

const router = Router();

router.post('/login', authRateLimit, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticate, changePassword);

export default router;
