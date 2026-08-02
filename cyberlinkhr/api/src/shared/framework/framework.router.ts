import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import {
  getCustomFields,
  createCustomField,
  deleteCustomField,
  getWorkflow,
  transitionWorkflow,
  getPermissions,
  updatePermission,
  getVersions,
  generatePdfFormat,
  getCompanySettings,
  saveCompanySettings
} from './framework.controller';

const router = Router();

// Secure all framework endpoints using resolveTenant + authenticate
router.use(authenticate, resolveTenant);

// Customisation Engine
router.get('/customisation/fields/:module', getCustomFields);
router.post('/customisation/fields', createCustomField);
router.delete('/customisation/fields/:id', deleteCustomField);

// Workflow Engine
router.get('/workflow/:module', getWorkflow);
router.post('/workflow/transition', transitionWorkflow);

// Permission Matrix
router.get('/permissions', getPermissions);
router.put('/permissions', updatePermission);

// Version history
router.get('/versions/:module/:recordId', getVersions);

// PDF Prints
router.get('/print/:module/:id', generatePdfFormat);

// Settings
router.get('/settings', getCompanySettings);
router.put('/settings', saveCompanySettings);

export default router;
