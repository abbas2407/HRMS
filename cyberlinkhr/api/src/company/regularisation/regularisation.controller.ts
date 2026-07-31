import { Request, Response } from 'express';
import { regularisationRequests, attendanceLogs, employees } from '../../shared/db/tenant.schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedIn: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requestedOut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().min(5),
});

// POST /regularisation
export async function createRequest(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const empId = req.user!.userId;
  const [row] = await req.runInTenant!(async (db) =>
    db.insert(regularisationRequests).values({
      employeeId: empId,
      ...parsed.data,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

// GET /regularisation — HR sees all; employee sees own
export async function listRequests(req: Request, res: Response) {
  const isHR = req.user!.role === 'HR_ADMIN';
  const empId = req.user!.userId;
  const { status } = req.query as Record<string, string>;

  const data = await req.runInTenant!(async (db) => {
    const conditions: any[] = [];
    if (!isHR) conditions.push(eq(regularisationRequests.employeeId, empId));
    if (status) conditions.push(eq(regularisationRequests.status, status));

    return db.select({
      id: regularisationRequests.id,
      date: regularisationRequests.date,
      requestedIn: regularisationRequests.requestedIn,
      requestedOut: regularisationRequests.requestedOut,
      reason: regularisationRequests.reason,
      status: regularisationRequests.status,
      reviewComment: regularisationRequests.reviewComment,
      createdAt: regularisationRequests.createdAt,
      reviewedAt: regularisationRequests.reviewedAt,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
      .from(regularisationRequests)
      .innerJoin(employees, eq(regularisationRequests.employeeId, employees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(regularisationRequests.createdAt));
  });

  return res.json({ data });
}

// PUT /regularisation/:id/approve
export async function approveRequest(req: Request, res: Response) {
  const id = String(req.params.id);
  const { comment } = req.body;

  const [request] = await req.runInTenant!(async (db) =>
    db.select().from(regularisationRequests).where(eq(regularisationRequests.id, id)).limit(1)
  );

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'PENDING') return res.status(400).json({ error: 'Request already processed' });

  await req.runInTenant!(async (db) => {
    // Update the regularisation request
    await db.update(regularisationRequests).set({
      status: 'APPROVED',
      reviewedBy: req.user!.userId,
      reviewComment: comment || null,
      reviewedAt: new Date(),
    }).where(eq(regularisationRequests.id, id));

    // Apply correction to attendance log
    const [existing] = await db.select().from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.employeeId, request.employeeId),
        eq(attendanceLogs.date, request.date),
      )).limit(1);

    const punchIn = request.requestedIn
      ? new Date(`${request.date}T${request.requestedIn}:00`)
      : existing?.punchIn;
    const punchOut = request.requestedOut
      ? new Date(`${request.date}T${request.requestedOut}:00`)
      : existing?.punchOut;
    const workingHours = punchIn && punchOut
      ? String(((punchOut.getTime() - punchIn.getTime()) / 3_600_000).toFixed(2))
      : existing?.workingHours;

    if (existing) {
      await db.update(attendanceLogs).set({
        punchIn,
        punchOut,
        workingHours: workingHours ?? undefined,
        status: 'PRESENT',
        regularisedBy: req.user!.userId,
        regularisedAt: new Date(),
        remarks: `Regularised: ${comment || 'Approved'}`,
      }).where(eq(attendanceLogs.id, existing.id));
    } else {
      await db.insert(attendanceLogs).values({
        employeeId: request.employeeId,
        date: request.date,
        punchIn,
        punchOut,
        workingHours: workingHours ?? undefined,
        status: 'PRESENT',
        regularisedBy: req.user!.userId,
        regularisedAt: new Date(),
        source: 'MANUAL',
      });
    }
  });

  return res.json({ data: { message: 'Request approved and attendance updated' } });
}

// PUT /regularisation/:id/reject
export async function rejectRequest(req: Request, res: Response) {
  const id = String(req.params.id);
  const { comment } = req.body;

  const [row] = await req.runInTenant!(async (db) =>
    db.update(regularisationRequests).set({
      status: 'REJECTED',
      reviewedBy: req.user!.userId,
      reviewComment: comment || null,
      reviewedAt: new Date(),
    }).where(and(
      eq(regularisationRequests.id, id),
      eq(regularisationRequests.status, 'PENDING'),
    )).returning()
  );

  if (!row) return res.status(404).json({ error: 'Request not found or already processed' });
  return res.json({ data: { message: 'Request rejected' } });
}
