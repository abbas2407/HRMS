import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import {
  listEmployeeDocuments, createEmployeeDocument, deleteEmployeeDocument,
} from './documents.controller';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', listEmployeeDocuments);
router.post('/', createEmployeeDocument);
router.delete('/:id', deleteEmployeeDocument);

export default router;
