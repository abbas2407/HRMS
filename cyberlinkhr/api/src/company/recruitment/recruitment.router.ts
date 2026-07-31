import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { resolveTenant } from '../../shared/middleware/tenant';
import { requireHRAdmin } from '../../shared/middleware/rbac';
import {
  listPostings, getPosting, createPosting, updatePostingStatus,
  listApplications, getApplication, addApplication, moveStage,
  scheduleInterview, recordInterviewOutcome,
} from './recruitment.controller';

const router = Router();
router.use(authenticate, resolveTenant);

// Job postings
router.get('/postings', listPostings);
router.get('/postings/:id', getPosting);
router.post('/postings', requireHRAdmin, createPosting);
router.patch('/postings/:id/status', requireHRAdmin, updatePostingStatus);

// Applications
router.get('/applications', requireHRAdmin, listApplications);
router.get('/applications/:id', requireHRAdmin, getApplication);
router.post('/postings/:jobId/apply', addApplication);
router.patch('/applications/:id/stage', requireHRAdmin, moveStage);

// Interviews
router.post('/applications/:id/interviews', requireHRAdmin, scheduleInterview);
router.patch('/interviews/:interviewId/outcome', requireHRAdmin, recordInterviewOutcome);

export default router;
