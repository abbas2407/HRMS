import { Request, Response } from 'express';
import { leaveBalances, leaveTypes, employees } from '../../shared/db/tenant.schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

// GET /leave/balance?employeeId=&year=
export async function getLeaveBalance(req: Request, res: Response) {
  const empId = (req.query.employeeId as string) || req.user!.employeeId;
  if (!empId) return res.status(400).json({ error: 'Employee profile not associated with this account' });
  const year = Number(req.query.year ?? new Date().getFullYear());

  const data = await req.runInTenant!(async (db) =>
    db.select({
      id: leaveBalances.id,
      leaveTypeId: leaveBalances.leaveTypeId,
      balance: leaveBalances.balance,
      consumed: leaveBalances.consumed,
      tentative: leaveBalances.tentative,
      year: leaveBalances.year,
      typeName: leaveTypes.name,
      typeCode: leaveTypes.code,
      maxDaysPerYear: leaveTypes.maxDaysPerYear,
      isPaid: leaveTypes.isPaid,
    })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(and(eq(leaveBalances.employeeId, empId), eq(leaveBalances.year, year)))
  );
  return res.json({ data });
}

// POST /leave/balance/credit — HR manually credits leave days
export async function creditLeave(req: Request, res: Response) {
  const schema = z.object({
    employeeId: z.string().uuid(),
    leaveTypeId: z.string().uuid(),
    year: z.number().int().min(2020).max(2100),
    days: z.number().min(0.5),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const { employeeId, leaveTypeId, year, days } = parsed.data;

  await req.runInTenant!(async (db) => {
    const [existing] = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.leaveTypeId, leaveTypeId),
        eq(leaveBalances.year, year),
      )).limit(1);

    if (existing) {
      await db.update(leaveBalances).set({
        balance: sql`${leaveBalances.balance} + ${String(days)}`,
      }).where(eq(leaveBalances.id, existing.id));
    } else {
      await db.insert(leaveBalances).values({
        employeeId, leaveTypeId, year,
        balance: String(days),
      });
    }
  });
  return res.json({ data: { message: 'Leave credited' } });
}

// POST /leave/balance/accrue — monthly accrual (also called by cron)
export async function accrueLeave(req: Request, res: Response) {
  await runAccrual(req.runInTenant!);
  return res.json({ data: { message: 'Accrual complete' } });
}

export async function runAccrual(run: Request['runInTenant']) {
  const year = new Date().getFullYear();
  const types = await run!(async (db) =>
    db.select().from(leaveTypes).where(and(eq(leaveTypes.isActive, true)))
  );
  const accrualTypes = types.filter(t => parseFloat(String(t.accrualPerMonth)) > 0);
  if (!accrualTypes.length) return;

  const emps = await run!(async (db) =>
    db.select({ id: employees.id }).from(employees).where(eq(employees.status, 'ACTIVE'))
  );

  for (const lt of accrualTypes) {
    const perMonth = parseFloat(String(lt.accrualPerMonth));
    for (const emp of emps) {
      await run!(async (db) => {
        const [existing] = await db.select().from(leaveBalances)
          .where(and(
            eq(leaveBalances.employeeId, emp.id),
            eq(leaveBalances.leaveTypeId, lt.id),
            eq(leaveBalances.year, year),
          )).limit(1);

        if (existing) {
          const cap = lt.carryForwardCap ?? 999;
          await db.update(leaveBalances).set({
            balance: sql`LEAST(${leaveBalances.balance} + ${String(perMonth)}, ${String(cap)})`,
          }).where(eq(leaveBalances.id, existing.id));
        } else {
          await db.insert(leaveBalances).values({
            employeeId: emp.id, leaveTypeId: lt.id, year,
            balance: String(perMonth),
          });
        }
      });
    }
  }
}
