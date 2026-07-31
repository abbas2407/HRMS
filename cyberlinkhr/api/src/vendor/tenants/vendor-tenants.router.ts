import { Router } from 'express';
import { authenticateVendor } from '../../shared/middleware/auth';
import {
  getDashboard, listTenants, createTenant, getTenant,
  updateStatus, extendTrial, updateSubscription, impersonate,
  getUsage, recordPayment, listPayments, getAuditLog, listPlans,
} from './vendor-tenants.controller';

const router = Router();
router.use(authenticateVendor);

router.get('/dashboard', getDashboard);
router.get('/plans', listPlans);
router.get('/', listTenants);
router.post('/', createTenant);
router.get('/:id', getTenant);
router.put('/:id/status', updateStatus);
router.put('/:id/trial', extendTrial);
router.put('/:id/subscription', updateSubscription);
router.post('/:id/impersonate', impersonate);
router.get('/:id/usage', getUsage);

export default router;
