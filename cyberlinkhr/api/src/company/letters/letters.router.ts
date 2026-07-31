import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listTemplates, updateTemplate, generateLetter, listLetters, getLetter } from './letters.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/templates', listTemplates);
router.put('/templates/:id', requireHRAdmin, updateTemplate);
router.post('/generate', requireHRAdmin, generateLetter);
router.get('/', listLetters);
router.get('/:id', getLetter);

export default router;
