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
  saveCompanySettings,
  getHooks,
  triggerHook,
  linkSearch,
  getPrintFormats,
  createPrintFormat,
  updatePrintFormat,
  deletePrintFormat,
  previewPrintFormat,
  getEmailAlerts,
  createEmailAlert,
  updateEmailAlert,
  deleteEmailAlert,
  testEmailAlert,
  getReports,
  createReport,
  updateReport,
  deleteReport,
  runReport,
  exportReport,
  exportReportExcel
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

// Lifecycle Hooks
router.get('/hooks', getHooks);
router.post('/hooks/trigger', triggerHook);

// Link Search Resolution
router.get('/link-search', linkSearch);

// Print Formats
router.get('/print-formats', getPrintFormats);
router.post('/print-formats', createPrintFormat);
router.put('/print-formats/:id', updatePrintFormat);
router.delete('/print-formats/:id', deletePrintFormat);
router.post('/print-formats/:id/preview', previewPrintFormat);

// Email Alerts
router.get('/email-alerts', getEmailAlerts);
router.post('/email-alerts', createEmailAlert);
router.put('/email-alerts/:id', updateEmailAlert);
router.delete('/email-alerts/:id', deleteEmailAlert);
router.post('/email-alerts/:id/test', testEmailAlert);

// Saved Reports
router.get('/reports', getReports);
router.post('/reports', createReport);
router.put('/reports/:id', updateReport);
router.delete('/reports/:id', deleteReport);
router.post('/reports/:id/run', runReport);
router.get('/reports/:id/export', exportReport);
router.get('/reports/:id/export-excel', exportReportExcel);

export default router;
