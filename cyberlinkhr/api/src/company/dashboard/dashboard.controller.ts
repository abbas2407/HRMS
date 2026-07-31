import { Request, Response } from 'express';
import { eq, and, gte, count, sql, or, isNull, desc } from 'drizzle-orm';
import {
  employees, attendanceLogs, leaveRequests, payrollRuns, announcements,
} from '../../shared/db/tenant.schema';

export async function getDashboard(req: Request, res: Response) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const now = new Date();

  const [
    empStats,
    todayAttendance,
    pendingLeaves,
    lastPayroll,
    recentJoiners,
    activeAnnouncements,
  ] = await Promise.all([
    // Headcount
    req.runInTenant!(async (db) => {
      const rows = await db.select({ status: employees.status, cnt: count() })
        .from(employees).groupBy(employees.status);
      const m: Record<string, number> = {};
      for (const r of rows) m[r.status] = Number(r.cnt);
      return { total: Object.values(m).reduce((s, v) => s + v, 0), active: m.ACTIVE || 0, inactive: m.INACTIVE || 0, separated: m.SEPARATED || 0 };
    }),

    // Today attendance breakdown
    req.runInTenant!(async (db) => {
      const rows = await db.select({ status: attendanceLogs.status, cnt: count() })
        .from(attendanceLogs)
        .where(eq(attendanceLogs.date, today))
        .groupBy(attendanceLogs.status);
      const m: Record<string, number> = {};
      for (const r of rows) m[r.status] = Number(r.cnt);
      const present = (m.PRESENT || 0) + (m.LATE || 0) + (m.HALF_DAY || 0);
      return { present, absent: m.ABSENT || 0, late: m.LATE || 0, onLeave: m.LEAVE || 0 };
    }),

    // Pending leave requests
    req.runInTenant!(async (db) => {
      const [row] = await db.select({ cnt: count() }).from(leaveRequests)
        .where(eq(leaveRequests.status as any, 'PENDING'));
      return Number(row?.cnt || 0);
    }),

    // Last payroll run
    req.runInTenant!(async (db) => {
      const [run] = await db.select().from(payrollRuns)
        .orderBy(sql`${payrollRuns.year} DESC, ${payrollRuns.month} DESC`).limit(1);
      return run || null;
    }),

    // Recent announcements
    req.runInTenant!(async (db) =>
      db.select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        isPinned: announcements.isPinned,
        targetType: announcements.targetType,
        createdAt: announcements.createdAt,
      })
        .from(announcements)
        .where(or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)))
        .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
        .limit(5)
    ),

    // Employees joined in last 30 days
    req.runInTenant!(async (db) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const rows = await db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        joiningDate: employees.joiningDate,
      })
        .from(employees)
        .where(and(gte(employees.joiningDate, since), eq(employees.status, 'ACTIVE')))
        .orderBy(sql`${employees.joiningDate} DESC`)
        .limit(5);
      return rows;
    }),
  ]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return res.json({
    data: {
      headcount: empStats,
      todayAttendance,
      pendingLeaves,
      announcements: activeAnnouncements,
      lastPayroll: lastPayroll ? {
        label: `${MONTHS[lastPayroll.month - 1]} ${lastPayroll.year}`,
        status: lastPayroll.status,
        totalNet: lastPayroll.totalNet,
        totalGross: lastPayroll.totalGross,
      } : null,
      recentJoiners,
    }
  });
}
