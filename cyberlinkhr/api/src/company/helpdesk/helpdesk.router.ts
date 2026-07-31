import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import { listTickets, getTicket, createTicket, updateTicket, addComment, getStats } from './helpdesk.controller';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/stats', requireHRAdmin, getStats);
router.get('/', listTickets);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.patch('/:id', requireHRAdmin, updateTicket);
router.post('/:id/comments', addComment);

export default router;
