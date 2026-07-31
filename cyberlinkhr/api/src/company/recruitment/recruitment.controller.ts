import { Request, Response } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { jobPostings, jobApplications, interviewSchedules, departments, designations, users, employees } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

const postingSchema = z.object({
  title: z.string().min(1).max(200),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  location: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  openings: z.number().int().min(1).default(1),
  closingDate: z.string().optional(),
});

const applicationSchema = z.object({
  applicantName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  currentCompany: z.string().optional(),
  currentRole: z.string().optional(),
  totalExperience: z.string().optional(),
  noticePeriod: z.string().optional(),
  expectedSalary: z.string().optional(),
});

const interviewSchema = z.object({
  scheduledAt: z.string(),
  durationMinutes: z.number().int().default(60),
  mode: z.enum(['VIDEO', 'PHONE', 'IN_PERSON']).default('VIDEO'),
  location: z.string().optional(),
  interviewers: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export async function listPostings(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: jobPostings.id,
      title: jobPostings.title,
      jobType: jobPostings.jobType,
      location: jobPostings.location,
      openings: jobPostings.openings,
      status: jobPostings.status,
      closingDate: jobPostings.closingDate,
      createdAt: jobPostings.createdAt,
      departmentName: departments.name,
      designationName: designations.name,
      applicationCount: sql<number>`(
        SELECT COUNT(*) FROM "${sql.raw(req.user!.schemaName)}".job_applications ja
        WHERE ja.job_id = ${jobPostings.id} AND ja.status = 'ACTIVE'
      )`,
    })
      .from(jobPostings)
      .leftJoin(departments, eq(jobPostings.departmentId, departments.id))
      .leftJoin(designations, eq(jobPostings.designationId, designations.id))
      .orderBy(desc(jobPostings.createdAt))
  );
  return res.json({ data: rows });
}

export async function getPosting(req: Request, res: Response) {
  const { id } = req.params;
  const [posting] = await req.runInTenant!(async (db) =>
    db.select({
      id: jobPostings.id,
      title: jobPostings.title,
      jobType: jobPostings.jobType,
      location: jobPostings.location,
      description: jobPostings.description,
      requirements: jobPostings.requirements,
      openings: jobPostings.openings,
      status: jobPostings.status,
      closingDate: jobPostings.closingDate,
      createdAt: jobPostings.createdAt,
      departmentName: departments.name,
      designationName: designations.name,
    })
      .from(jobPostings)
      .leftJoin(departments, eq(jobPostings.departmentId, departments.id))
      .leftJoin(designations, eq(jobPostings.designationId, designations.id))
      .where(eq(jobPostings.id, id))
  );
  if (!posting) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: posting });
}

export async function createPosting(req: Request, res: Response) {
  const parsed = postingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const data = parsed.data;

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(jobPostings).values({
      title: data.title,
      departmentId: data.departmentId || null,
      designationId: data.designationId || null,
      jobType: data.jobType,
      location: data.location || null,
      description: data.description || null,
      requirements: data.requirements || null,
      openings: data.openings,
      closingDate: data.closingDate || null,
      createdBy: req.user!.userId,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updatePostingStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['OPEN', 'PAUSED', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const [row] = await req.runInTenant!(async (db) =>
    db.update(jobPostings).set({ status, updatedAt: new Date() }).where(eq(jobPostings.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function listApplications(req: Request, res: Response) {
  const { jobId } = req.query;
  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      applicantName: jobApplications.applicantName,
      email: jobApplications.email,
      phone: jobApplications.phone,
      currentCompany: jobApplications.currentCompany,
      currentRole: jobApplications.currentRole,
      totalExperience: jobApplications.totalExperience,
      noticePeriod: jobApplications.noticePeriod,
      expectedSalary: jobApplications.expectedSalary,
      stage: jobApplications.stage,
      status: jobApplications.status,
      notes: jobApplications.notes,
      appliedAt: jobApplications.appliedAt,
      updatedAt: jobApplications.updatedAt,
      jobTitle: jobPostings.title,
    })
      .from(jobApplications)
      .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
      .where(jobId ? eq(jobApplications.jobId, jobId as string) : sql`1=1`)
      .orderBy(desc(jobApplications.appliedAt))
  );
  return res.json({ data: rows });
}

export async function getApplication(req: Request, res: Response) {
  const { id } = req.params;
  const [app] = await req.runInTenant!(async (db) =>
    db.select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      applicantName: jobApplications.applicantName,
      email: jobApplications.email,
      phone: jobApplications.phone,
      resumeUrl: jobApplications.resumeUrl,
      currentCompany: jobApplications.currentCompany,
      currentRole: jobApplications.currentRole,
      totalExperience: jobApplications.totalExperience,
      noticePeriod: jobApplications.noticePeriod,
      expectedSalary: jobApplications.expectedSalary,
      stage: jobApplications.stage,
      status: jobApplications.status,
      notes: jobApplications.notes,
      appliedAt: jobApplications.appliedAt,
      updatedAt: jobApplications.updatedAt,
      jobTitle: jobPostings.title,
    })
      .from(jobApplications)
      .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
      .where(eq(jobApplications.id, id))
  );
  if (!app) return res.status(404).json({ error: 'Not found' });

  const interviews = await req.runInTenant!(async (db) =>
    db.select().from(interviewSchedules)
      .where(eq(interviewSchedules.applicationId, id))
      .orderBy(interviewSchedules.scheduledAt)
  );

  return res.json({ data: { ...app, interviews } });
}

export async function addApplication(req: Request, res: Response) {
  const { jobId } = req.params;
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [posting] = await req.runInTenant!(async (db) =>
    db.select({ id: jobPostings.id, status: jobPostings.status })
      .from(jobPostings).where(eq(jobPostings.id, jobId))
  );
  if (!posting) return res.status(404).json({ error: 'Job not found' });
  if (posting.status !== 'OPEN') return res.status(400).json({ error: 'Job is not accepting applications' });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(jobApplications).values({
      jobId,
      ...parsed.data,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function moveStage(req: Request, res: Response) {
  const { id } = req.params;
  const { stage, notes } = req.body;
  if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

  const updates: any = { stage, updatedAt: new Date() };
  if (notes !== undefined) updates.notes = notes;
  if (stage === 'HIRED' || stage === 'REJECTED') updates.status = 'CLOSED';

  const [row] = await req.runInTenant!(async (db) =>
    db.update(jobApplications).set(updates).where(eq(jobApplications.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function scheduleInterview(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = interviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(interviewSchedules).values({
      applicationId: id,
      scheduledAt: new Date(parsed.data.scheduledAt),
      durationMinutes: parsed.data.durationMinutes,
      mode: parsed.data.mode,
      location: parsed.data.location || null,
      interviewers: parsed.data.interviewers,
      notes: parsed.data.notes || null,
      createdBy: req.user!.userId,
    }).returning()
  );

  // Auto-advance to INTERVIEW stage if still in APPLIED/SCREENING
  await req.runInTenant!(async (db) =>
    db.update(jobApplications)
      .set({ stage: 'INTERVIEW', updatedAt: new Date() })
      .where(and(
        eq(jobApplications.id, id),
        sql`${jobApplications.stage} IN ('APPLIED', 'SCREENING')`
      ))
  );

  return res.status(201).json({ data: row });
}

export async function recordInterviewOutcome(req: Request, res: Response) {
  const { interviewId } = req.params;
  const { outcome, feedback } = req.body;
  if (!['PASS', 'FAIL', 'ON_HOLD'].includes(outcome)) {
    return res.status(400).json({ error: 'Invalid outcome' });
  }
  const [row] = await req.runInTenant!(async (db) =>
    db.update(interviewSchedules)
      .set({ outcome, feedback: feedback || null })
      .where(eq(interviewSchedules.id, interviewId))
      .returning()
  );
  return res.json({ data: row });
}
