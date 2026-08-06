import { Router } from 'express';
import { authenticateVendor } from '../../shared/middleware/auth';
import {
  getDashboard, listTenants, createTenant, getTenant, deleteTenant,
  updateTenant, updateStatus, extendTrial, updateSubscription, impersonate,
  getUsage, recordPayment, listPayments, getAuditLog, listPlans, resetTenantPassword,
} from './vendor-tenants.controller';

const router = Router();
router.use(authenticateVendor);

router.get('/dashboard', getDashboard);
router.get('/plans', listPlans);

// Standard tenant routes matching frontend API calls
router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:id', getTenant);
router.put('/tenants/:id', updateTenant);
router.put('/tenants/:id/reset-password', resetTenantPassword);
router.put('/tenants/:id/status', updateStatus);
router.put('/tenants/:id/trial', extendTrial);
router.put('/tenants/:id/subscription', updateSubscription);
router.post('/tenants/:id/impersonate', impersonate);
router.get('/tenants/:id/usage', getUsage);
router.delete('/tenants/:id', deleteTenant);

// Fallbacks/Legacy routes
router.get('/', listTenants);
router.post('/', createTenant);
router.get('/:id', getTenant);
router.put('/:id', updateTenant);
router.put('/:id/reset-password', resetTenantPassword);
router.delete('/:id', deleteTenant);
router.put('/:id/status', updateStatus);
router.put('/:id/trial', extendTrial);
router.put('/:id/subscription', updateSubscription);
router.post('/:id/impersonate', impersonate);
router.get('/:id/usage', getUsage);

export default router;
