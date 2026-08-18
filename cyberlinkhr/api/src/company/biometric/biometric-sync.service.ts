import ZKLib from 'node-zklib';
import { biometricDevices, employeeBiometricIds, attendanceLogs } from '../../shared/db/tenant.schema';
import { eq, and } from 'drizzle-orm';
import logger from '../../shared/utils/logger';

export async function syncDevice(runInTenant: any, device: { id: string; ipAddress: string; port: number; lastSyncedAt: Date | null }) {
  const zk = new ZKLib(device.ipAddress, device.port, 10000, 4000);
  try {
    await zk.createSocket();
    const res = await zk.getAttendances();
    await zk.disconnect();

    const logs: any[] = res?.data || [];
    const cutoff = device.lastSyncedAt ? new Date(device.lastSyncedAt).getTime() : 0;
    const newLogs = logs.filter((l: any) => new Date(l.recordTime).getTime() > cutoff);

    await runInTenant(async (db: any) => {
      for (const log of newLogs) {
        const uid = Number(log.deviceUserId);
        if (isNaN(uid)) continue;

        const [enrollment] = await db
          .select({ employeeId: employeeBiometricIds.employeeId })
          .from(employeeBiometricIds)
          .where(and(eq(employeeBiometricIds.deviceId, device.id), eq(employeeBiometricIds.biometricUid, uid)))
          .limit(1);

        if (!enrollment?.employeeId) continue;

        const punchTime = new Date(log.recordTime);
        const dateStr = punchTime.toISOString().split('T')[0];
        const employeeId = enrollment.employeeId;
        const isIn = log.type === 0 || (log.type !== 1 && punchTime.getHours() < 12);

        const [existing] = await db
          .select()
          .from(attendanceLogs)
          .where(and(eq(attendanceLogs.employeeId, employeeId), eq(attendanceLogs.date, dateStr)))
          .limit(1);

        if (existing) {
          if (isIn) {
            await db
              .update(attendanceLogs)
              .set({ punchIn: punchTime, source: 'BIOMETRIC', status: 'PRESENT' })
              .where(eq(attendanceLogs.id, existing.id));
          } else {
            await db
              .update(attendanceLogs)
              .set({ punchOut: punchTime, source: 'BIOMETRIC', status: 'PRESENT' })
              .where(eq(attendanceLogs.id, existing.id));
          }
        } else {
          await db.insert(attendanceLogs).values({
            employeeId,
            date: dateStr,
            punchIn: isIn ? punchTime : null,
            punchOut: isIn ? null : punchTime,
            status: 'PRESENT',
            source: 'BIOMETRIC',
          });
        }
      }

      await db
        .update(biometricDevices)
        .set({ lastSyncedAt: new Date() })
        .where(eq(biometricDevices.id, device.id));
    });
  } catch (err: any) {
    logger.error(`[BiometricSync] Device ${device.id} (${device.ipAddress}:${device.port}) failed: ${err?.message || err}`);
    try { await zk.disconnect(); } catch {}
  }
}

export async function fetchDeviceUsers(ipAddress: string, port: number = 4370) {
  const zk = new ZKLib(ipAddress, port, 10000, 4000);
  await zk.createSocket();
  const res = await zk.getUsers();
  await zk.disconnect();
  return res?.data || [];
}

export async function testDeviceConnection(ipAddress: string, port: number = 4370) {
  const zk = new ZKLib(ipAddress, port, 5000, 2000);
  await zk.createSocket();
  const info = await zk.getInfo();
  await zk.disconnect();
  return info;
}
