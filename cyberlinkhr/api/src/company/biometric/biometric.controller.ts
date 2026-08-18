import { Request, Response } from 'express';
import { biometricDevices, employeeBiometricIds, employees } from '../../shared/db/tenant.schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { syncDevice, fetchDeviceUsers, testDeviceConnection } from './biometric-sync.service';

const deviceSchema = z.object({
  name: z.string().min(1).max(100),
  ipAddress: z.string().min(1).max(50),
  port: z.number().int().default(4370),
  deviceSerial: z.string().optional(),
  isActive: z.boolean().default(true),
});

const enrollSchema = z.object({
  employeeId: z.string().uuid(),
  deviceId: z.string().uuid(),
  biometricUid: z.number().int().positive(),
});

// GET /api/biometric/devices
export async function listDevices(req: Request, res: Response) {
  const devices = await req.runInTenant!(async (db) =>
    db.select().from(biometricDevices).orderBy(biometricDevices.createdAt)
  );
  return res.json({ data: devices });
}

// POST /api/biometric/devices
export async function createDevice(req: Request, res: Response) {
  const parsed = deviceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(biometricDevices).values(parsed.data).returning()
  );
  return res.status(201).json({ data: row });
}

// POST /api/biometric/devices/:id/test
export async function testDevice(req: Request, res: Response) {
  const id = String(req.params.id);
  const [device] = await req.runInTenant!(async (db) =>
    db.select().from(biometricDevices).where(eq(biometricDevices.id, id)).limit(1)
  );
  if (!device) return res.status(404).json({ error: 'Device not found' });

  try {
    const info = await testDeviceConnection(device.ipAddress, device.port);
    return res.json({ message: 'Connection successful', info });
  } catch (err: any) {
    return res.status(500).json({ error: `Connection failed: ${err?.message || err}` });
  }
}

// POST /api/biometric/devices/:id/sync
export async function syncDeviceNow(req: Request, res: Response) {
  const id = String(req.params.id);
  const [device] = await req.runInTenant!(async (db) =>
    db.select().from(biometricDevices).where(eq(biometricDevices.id, id)).limit(1)
  );
  if (!device) return res.status(404).json({ error: 'Device not found' });

  try {
    await syncDevice(req.runInTenant!, device);
    return res.json({ message: 'Device sync completed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: `Sync failed: ${err?.message || err}` });
  }
}

// GET /api/biometric/devices/:id/users
export async function getDeviceUsers(req: Request, res: Response) {
  const id = String(req.params.id);
  const [device] = await req.runInTenant!(async (db) =>
    db.select().from(biometricDevices).where(eq(biometricDevices.id, id)).limit(1)
  );
  if (!device) return res.status(404).json({ error: 'Device not found' });

  try {
    const users = await fetchDeviceUsers(device.ipAddress, device.port);
    return res.json({ data: users });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to fetch device users: ${err?.message || err}` });
  }
}

// GET /api/biometric/enrollments
export async function listEnrollments(req: Request, res: Response) {
  const { deviceId } = req.query;
  const list = await req.runInTenant!(async (db) => {
    const conditions = [];
    if (deviceId) conditions.push(eq(employeeBiometricIds.deviceId, String(deviceId)));
    return db
      .select({
        id: employeeBiometricIds.id,
        employeeId: employeeBiometricIds.employeeId,
        deviceId: employeeBiometricIds.deviceId,
        biometricUid: employeeBiometricIds.biometricUid,
        enrolledAt: employeeBiometricIds.enrolledAt,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        deviceName: biometricDevices.name,
      })
      .from(employeeBiometricIds)
      .leftJoin(employees, eq(employeeBiometricIds.employeeId, employees.id))
      .leftJoin(biometricDevices, eq(employeeBiometricIds.deviceId, biometricDevices.id))
      .where(conditions.length ? and(...conditions) : undefined);
  });
  return res.json({ data: list });
}

// POST /api/biometric/enroll
export async function enrollEmployee(req: Request, res: Response) {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(employeeBiometricIds).values(parsed.data).returning()
  );
  return res.status(201).json({ data: row });
}

// DELETE /api/biometric/enroll/:id
export async function deleteEnrollment(req: Request, res: Response) {
  const id = String(req.params.id);
  const [deleted] = await req.runInTenant!(async (db) =>
    db.delete(employeeBiometricIds).where(eq(employeeBiometricIds.id, id)).returning()
  );
  if (!deleted) return res.status(404).json({ error: 'Enrollment not found' });
  return res.json({ message: 'Enrollment deleted successfully' });
}
