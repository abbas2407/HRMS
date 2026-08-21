import { Request, Response } from 'express';
import { deviceDetectRequests, employees, departments, designations } from '../../shared/db/tenant.schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';

// GET /attendance/device-detect
export async function listDeviceDetectRequests(req: Request, res: Response) {
  const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : undefined;

  const data = await req.runInTenant!(async (db) => {
    let query = db.select({
      id: deviceDetectRequests.id,
      device: deviceDetectRequests.device,
      model: deviceDetectRequests.model,
      reason: deviceDetectRequests.reason,
      requestedDeviceId: deviceDetectRequests.requestedDeviceId,
      lastRegistrationDate: deviceDetectRequests.lastRegistrationDate,
      status: deviceDetectRequests.status,
      requestDate: deviceDetectRequests.requestDate,
      createdAt: deviceDetectRequests.createdAt,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      photoUrl: employees.photoUrl,
      departmentName: departments.name,
      designationName: designations.name,
    })
      .from(deviceDetectRequests)
      .innerJoin(employees, eq(deviceDetectRequests.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .orderBy(desc(deviceDetectRequests.requestDate));

    if (statusFilter && (statusFilter === 'PENDING' || statusFilter === 'ACCEPTED' || statusFilter === 'REJECTED')) {
      return query.where(eq(deviceDetectRequests.status, statusFilter));
    }

    return query;
  });

  return res.json({ data });
}

// GET /attendance/device-detect/:id — details view with employee history (Image 4)
export async function getDeviceDetectDetails(req: Request, res: Response) {
  const id = String(req.params.id);

  const [reqDetail] = await req.runInTenant!(async (db) =>
    db.select({
      id: deviceDetectRequests.id,
      device: deviceDetectRequests.device,
      model: deviceDetectRequests.model,
      reason: deviceDetectRequests.reason,
      requestedDeviceId: deviceDetectRequests.requestedDeviceId,
      lastRegistrationDate: deviceDetectRequests.lastRegistrationDate,
      status: deviceDetectRequests.status,
      requestDate: deviceDetectRequests.requestDate,
      createdAt: deviceDetectRequests.createdAt,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentName: departments.name,
      designationName: designations.name,
    })
      .from(deviceDetectRequests)
      .innerJoin(employees, eq(deviceDetectRequests.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(eq(deviceDetectRequests.id, id))
      .limit(1)
  );

  if (!reqDetail) return res.status(404).json({ error: 'Device detect request not found' });

  // Get previous history for this employee
  const history = await req.runInTenant!(async (db) =>
    db.select({
      id: deviceDetectRequests.id,
      device: deviceDetectRequests.device,
      model: deviceDetectRequests.model,
      reason: deviceDetectRequests.reason,
      status: deviceDetectRequests.status,
      requestDate: deviceDetectRequests.requestDate,
      createdAt: deviceDetectRequests.createdAt,
    })
      .from(deviceDetectRequests)
      .where(and(
        eq(deviceDetectRequests.employeeId, reqDetail.employeeId),
        // Exclude current request
      ))
      .orderBy(desc(deviceDetectRequests.requestDate))
  );

  return res.json({
    data: {
      request: reqDetail,
      history: history.filter(h => h.id !== id),
    }
  });
}

// POST /attendance/device-detect — employee submits device change request
export async function createDeviceDetectRequest(req: Request, res: Response) {
  const parsed = z.object({
    employeeId: z.string().uuid().optional(),
    device: z.string(),
    model: z.string(),
    reason: z.string(),
    requestedDeviceId: z.string(),
    lastRegistrationDate: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const empId = parsed.data.employeeId || req.user?.userId;
  if (!empId) return res.status(400).json({ error: 'Employee ID required' });

  const todayStr = new Date().toISOString().split('T')[0];

  const [created] = await req.runInTenant!(async (db) =>
    db.insert(deviceDetectRequests).values({
      employeeId: empId,
      device: parsed.data.device,
      model: parsed.data.model,
      reason: parsed.data.reason,
      requestedDeviceId: parsed.data.requestedDeviceId,
      lastRegistrationDate: (parsed.data.lastRegistrationDate || todayStr) as any,
      status: 'PENDING',
      requestDate: todayStr as any,
    }).returning()
  );

  return res.status(201).json({ data: created });
}

// PUT /attendance/device-detect/:id/status — Admin approves/rejects device request
export async function updateDeviceDetectStatus(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = z.object({
    status: z.enum(['ACCEPTED', 'REJECTED']),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Status must be ACCEPTED or REJECTED' });

  const [updated] = await req.runInTenant!(async (db) =>
    db.update(deviceDetectRequests)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(deviceDetectRequests.id, id))
      .returning()
  );

  if (!updated) return res.status(404).json({ error: 'Request not found' });
  return res.json({ data: updated });
}
