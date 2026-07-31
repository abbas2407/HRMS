import { Request, Response } from 'express';
import {
  attendanceLogs, employees, departments, shifts, shiftAssignments,
  officeLocations,
} from '../../shared/db/tenant.schema';
import { eq, and, lte, gte, desc, sql, between } from 'drizzle-orm';
import { emitToTenant } from '../../shared/utils/socket';
import { z } from 'zod';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

async function getEmployeeShift(run: Request['runInTenant'], empId: string) {
  const today = todayStr();
  const [row] = await run!(async (db) =>
    db.select({ shift: shifts })
      .from(shiftAssignments)
      .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .where(and(eq(shiftAssignments.employeeId, empId), lte(shiftAssignments.effectiveFrom, today)))
      .orderBy(desc(shiftAssignments.effectiveFrom))
      .limit(1)
  );
  return row?.shift ?? null;
}

// POST /attendance/punch-in
export async function punchIn(req: Request, res: Response) {
  const empId = req.user!.userId;
  const today = todayStr();
  const now = new Date();

  const existing = await req.runInTenant!(async (db) => {
    const [r] = await db.select().from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, empId), eq(attendanceLogs.date, today))).limit(1);
    return r;
  });

  if (existing?.punchIn) {
    return res.status(400).json({ error: 'Already punched in today' });
  }

  const shift = await getEmployeeShift(req.runInTenant, empId);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const shiftStartMins = shift ? timeToMinutes(shift.startTime) + (shift.graceMinutes ?? 10) : null;
  const isLate = shiftStartMins !== null ? nowMins > shiftStartMins : false;
  const lateByMinutes = isLate && shiftStartMins ? nowMins - shiftStartMins : 0;

  const { lat, lng } = req.body;
  const ip = req.ip || '';

  // --- Geo-fence check ---
  let matchedLocationId: string | null = null;
  let geoDistanceMeters: number | null = null;

  if (lat !== undefined && lng !== undefined) {
    const [empRow] = await req.runInTenant!(async (db) =>
      db.select({ isGeoExempt: employees.isGeoExempt })
        .from(employees).where(eq(employees.id, empId)).limit(1)
    );
    const isGeoExempt = empRow?.isGeoExempt ?? false;

    if (!isGeoExempt) {
      const locations = await req.runInTenant!(async (db) =>
        db.select().from(officeLocations).where(eq(officeLocations.isActive, true))
      );

      if (locations.length > 0) {
        let nearest: { id: string; dist: number } | null = null;
        for (const loc of locations) {
          const dist = Math.round(haversineMeters(
            Number(lat), Number(lng),
            Number(loc.lat), Number(loc.lng)
          ));
          if (!nearest || dist < nearest.dist) nearest = { id: loc.id, dist };
          if (dist <= (loc.radiusMeters ?? 100)) {
            matchedLocationId = loc.id;
            geoDistanceMeters = dist;
            break;
          }
        }
        if (!matchedLocationId) {
          geoDistanceMeters = nearest?.dist ?? null;
          return res.status(403).json({
            error: 'You are outside all office locations',
            geoDistanceMeters,
            code: 'GEO_FENCE_VIOLATION',
          });
        }
      }
      // No active locations configured → no fence enforcement
    }
  }
  // --- End geo-fence check ---

  const [log] = await req.runInTenant!(async (db) => {
    if (existing) {
      return db.update(attendanceLogs).set({
        punchIn: now,
        punchInLat: lat ? String(lat) : null,
        punchInLng: lng ? String(lng) : null,
        punchInIp: ip,
        officeLocationId: matchedLocationId,
        geoDistanceMeters,
        status: isLate ? 'LATE' : 'PRESENT',
        isLate,
        lateByMinutes,
        source: req.body.source || 'WEB',
      }).where(eq(attendanceLogs.id, existing.id)).returning();
    }
    return db.insert(attendanceLogs).values({
      employeeId: empId,
      date: today,
      punchIn: now,
      punchInLat: lat ? String(lat) : null,
      punchInLng: lng ? String(lng) : null,
      punchInIp: ip,
      officeLocationId: matchedLocationId,
      geoDistanceMeters,
      status: isLate ? 'LATE' : 'PRESENT',
      isLate,
      lateByMinutes,
      source: req.body.source || 'WEB',
    }).returning();
  });

  // Get employee name for live board
  const [emp] = await req.runInTenant!(async (db) =>
    db.select({ firstName: employees.firstName, lastName: employees.lastName, departmentId: employees.departmentId })
      .from(employees).where(eq(employees.id, empId)).limit(1)
  );

  emitToTenant(req.tenant!.schemaName, 'attendance:update', {
    employeeId: empId,
    firstName: emp?.firstName,
    lastName: emp?.lastName,
    punchIn: log.punchIn,
    punchOut: null,
    status: log.status,
    isLate: log.isLate,
    lateByMinutes: log.lateByMinutes,
  });

  return res.json({ data: log });
}

// POST /attendance/punch-out
export async function punchOut(req: Request, res: Response) {
  const empId = req.user!.userId;
  const today = todayStr();
  const now = new Date();

  const [existing] = await req.runInTenant!(async (db) =>
    db.select().from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, empId), eq(attendanceLogs.date, today))).limit(1)
  );

  if (!existing) return res.status(400).json({ error: 'No punch-in found for today' });
  if (existing.punchOut) return res.status(400).json({ error: 'Already punched out today' });
  if (!existing.punchIn) return res.status(400).json({ error: 'Punch in first' });

  const workingHoursDecimal = (now.getTime() - existing.punchIn.getTime()) / 3_600_000;
  const isHalfDay = workingHoursDecimal < 4;

  const status = isHalfDay ? 'HALF_DAY' : (existing.status === 'LATE' ? 'LATE' : 'PRESENT');

  const shift = await getEmployeeShift(req.runInTenant, empId);
  const shiftEndMins = shift ? timeToMinutes(shift.endTime) : null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const overtimeMinutes = shiftEndMins && nowMins > shiftEndMins ? nowMins - shiftEndMins : 0;

  const [log] = await req.runInTenant!(async (db) =>
    db.update(attendanceLogs).set({
      punchOut: now,
      workingHours: String(workingHoursDecimal.toFixed(2)),
      status,
      overtimeMinutes,
    }).where(eq(attendanceLogs.id, existing.id)).returning()
  );

  emitToTenant(req.tenant!.schemaName, 'attendance:update', {
    employeeId: empId,
    punchIn: log.punchIn,
    punchOut: log.punchOut,
    status: log.status,
    workingHours: log.workingHours,
  });

  return res.json({ data: log });
}

// GET /attendance/today (my punch status)
export async function getMyToday(req: Request, res: Response) {
  const empId = req.user!.userId;
  const today = todayStr();

  const [log] = await req.runInTenant!(async (db) =>
    db.select().from(attendanceLogs)
      .where(and(eq(attendanceLogs.employeeId, empId), eq(attendanceLogs.date, today))).limit(1)
  );

  const shift = await getEmployeeShift(req.runInTenant, empId);
  return res.json({ data: { log: log || null, shift } });
}

// GET /attendance/my?month=MM&year=YYYY
export async function getMyAttendance(req: Request, res: Response) {
  const empId = req.user!.userId;
  const now = new Date();
  const month = Number(req.query.month ?? now.getMonth() + 1);
  const year = Number(req.query.year ?? now.getFullYear());
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = new Date(year, month, 0).toISOString().split('T')[0];

  const data = await req.runInTenant!(async (db) =>
    db.select().from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.employeeId, empId),
        gte(attendanceLogs.date, from),
        lte(attendanceLogs.date, to),
      ))
      .orderBy(attendanceLogs.date)
  );

  return res.json({ data, meta: { month, year, from, to } });
}

// GET /attendance/live — today's board for all employees (HR)
export async function getLiveBoard(req: Request, res: Response) {
  const today = todayStr();

  const data = await req.runInTenant!(async (db) =>
    db.select({
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      departmentName: departments.name,
      punchIn: attendanceLogs.punchIn,
      punchOut: attendanceLogs.punchOut,
      workingHours: attendanceLogs.workingHours,
      status: attendanceLogs.status,
      isLate: attendanceLogs.isLate,
      lateByMinutes: attendanceLogs.lateByMinutes,
      source: attendanceLogs.source,
    })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(
        attendanceLogs,
        and(eq(attendanceLogs.employeeId, employees.id), eq(attendanceLogs.date, today))
      )
      .where(eq(employees.status, 'ACTIVE'))
      .orderBy(employees.employeeCode)
  );

  const punched = data.filter(r => r.punchIn);
  const notPunched = data.filter(r => !r.punchIn);

  return res.json({
    data: { punched, notPunched, total: data.length, date: today },
  });
}

// GET /attendance?date=&employeeId=&status= (HR all-employee view)
export async function listAttendance(req: Request, res: Response) {
  const { date = todayStr(), employeeId, status, page = '1', limit = '50' } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const data = await req.runInTenant!(async (db) => {
    const conditions: any[] = [eq(attendanceLogs.date, date)];
    if (employeeId) conditions.push(eq(attendanceLogs.employeeId, employeeId));
    if (status) conditions.push(eq(attendanceLogs.status, status as any));

    return db.select({
      id: attendanceLogs.id,
      date: attendanceLogs.date,
      punchIn: attendanceLogs.punchIn,
      punchOut: attendanceLogs.punchOut,
      workingHours: attendanceLogs.workingHours,
      overtimeMinutes: attendanceLogs.overtimeMinutes,
      status: attendanceLogs.status,
      isLate: attendanceLogs.isLate,
      lateByMinutes: attendanceLogs.lateByMinutes,
      remarks: attendanceLogs.remarks,
      source: attendanceLogs.source,
      geoDistanceMeters: attendanceLogs.geoDistanceMeters,
      officeLocationId: attendanceLogs.officeLocationId,
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      isGeoExempt: employees.isGeoExempt,
      departmentName: departments.name,
      officeLocationName: officeLocations.name,
    })
      .from(attendanceLogs)
      .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(officeLocations, eq(attendanceLogs.officeLocationId, officeLocations.id))
      .where(and(...conditions))
      .orderBy(employees.employeeCode)
      .limit(Number(limit))
      .offset(offset);
  });

  return res.json({ data });
}

// GET /attendance/geo-report — HR: punches with no GPS + exempt employees list
export async function getGeoReport(req: Request, res: Response) {
  const { from, to } = req.query as Record<string, string>;
  const today = todayStr();
  const fromDate = from || today;
  const toDate = to || today;

  const [noGpsPunches, exemptEmployees] = await req.runInTenant!(async (db) =>
    Promise.all([
      db.select({
        id: attendanceLogs.id,
        date: attendanceLogs.date,
        punchIn: attendanceLogs.punchIn,
        punchOut: attendanceLogs.punchOut,
        status: attendanceLogs.status,
        source: attendanceLogs.source,
        geoDistanceMeters: attendanceLogs.geoDistanceMeters,
        officeLocationId: attendanceLogs.officeLocationId,
        employeeId: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        isGeoExempt: employees.isGeoExempt,
        departmentName: departments.name,
      })
        .from(attendanceLogs)
        .innerJoin(employees, eq(attendanceLogs.employeeId, employees.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(and(
          gte(attendanceLogs.date, fromDate),
          lte(attendanceLogs.date, toDate),
          sql`${attendanceLogs.punchInLat} IS NULL`,
        ))
        .orderBy(desc(attendanceLogs.date), employees.employeeCode),

      db.select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        departmentName: departments.name,
        isGeoExempt: employees.isGeoExempt,
      })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(and(eq(employees.status, 'ACTIVE'), eq(employees.isGeoExempt, true)))
        .orderBy(employees.employeeCode),
    ])
  );

  return res.json({ data: { noGpsPunches, exemptEmployees } });
}

// PUT /attendance/:id — HR manual correction
export async function manualCorrect(req: Request, res: Response) {
  const { punchIn, punchOut, status, remarks } = req.body;
  const id = String(req.params.id);

  const update: any = { regularisedBy: req.user!.userId, regularisedAt: new Date() };
  if (punchIn) update.punchIn = new Date(punchIn);
  if (punchOut) update.punchOut = new Date(punchOut);
  if (status) update.status = status;
  if (remarks) update.remarks = remarks;

  if (update.punchIn && update.punchOut) {
    const hrs = (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / 3_600_000;
    update.workingHours = String(hrs.toFixed(2));
  }

  const [log] = await req.runInTenant!(async (db) =>
    db.update(attendanceLogs).set(update).where(eq(attendanceLogs.id, id)).returning()
  );
  if (!log) return res.status(404).json({ error: 'Record not found' });
  return res.json({ data: log });
}
