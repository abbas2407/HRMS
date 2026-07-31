import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import {
  upload, uploadDocument, listDocuments, deleteDocument, downloadDocument, getDocChecklist,
} from './documents.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.post('/:empId', upload.single('file'), uploadDocument);
router.get('/', listDocuments);
router.get('/checklist/:empId', getDocChecklist);
router.delete('/:id', deleteDocument);
router.get('/:id/download', downloadDocument);

export default router;
