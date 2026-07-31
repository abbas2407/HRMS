import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listFolders, createFolder, updateFolder,
  listDocuments, uploadDocument, deleteDocument, downloadVaultDocument,
  vaultUpload,
} from './vault.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/folders', listFolders);
router.post('/folders', requireHRAdmin, createFolder);
router.patch('/folders/:id', requireHRAdmin, updateFolder);

router.get('/folders/:folderId/documents', listDocuments);
router.post('/folders/:folderId/documents', requireHRAdmin, vaultUpload.single('file'), uploadDocument);
router.delete('/documents/:id', requireHRAdmin, deleteDocument);
router.get('/download/:id', downloadVaultDocument);

export default router;
