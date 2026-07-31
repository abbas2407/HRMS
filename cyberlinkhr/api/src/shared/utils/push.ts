import https from 'https';

interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

export async function sendExpoPush(messages: PushMessage | PushMessage[]): Promise<void> {
  const payload = Array.isArray(messages) ? messages : [messages];
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Send push to all device tokens for a set of userIds within a tenant
export async function pushToUsers(
  runInTenant: Request['runInTenant'],
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!userIds.length) return;

  const { deviceTokens } = await import('../db/tenant.schema');
  const { inArray } = await import('drizzle-orm');

  const tokens: string[] = await runInTenant!(async (db) => {
    const rows = await db.select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(inArray(deviceTokens.userId, userIds));
    return rows.map(r => r.token);
  });

  if (!tokens.length) return;

  // Batch in chunks of 100 (Expo limit)
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    await sendExpoPush(chunk.map(to => ({ to, title, body: body, data, sound: 'default' })));
  }
}

// Allow import in non-request contexts
import type { Request } from 'express';
