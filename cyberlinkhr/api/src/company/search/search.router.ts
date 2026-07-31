import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { globalSearch } from './search.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/', globalSearch);

export default router;
