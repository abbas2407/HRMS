import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from './connection';
import * as tenantSchema from './tenant.schema';

const tenantDBCache = new Map<string, NodePgDatabase<typeof tenantSchema>>();

export function getTenantDB(schemaName: string): NodePgDatabase<typeof tenantSchema> {
  if (tenantDBCache.has(schemaName)) {
    return tenantDBCache.get(schemaName)!;
  }

  const tenantDb = drizzle(pool, {
    schema: tenantSchema,
    logger: process.env.NODE_ENV === 'development',
  });

  tenantDBCache.set(schemaName, tenantDb);
  return tenantDb;
}

export async function runInTenantSchema<T>(
  schemaName: string,
  fn: (db: NodePgDatabase<typeof tenantSchema>) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}", public`);
    const db = drizzle(client, { schema: tenantSchema });
    return await fn(db);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}
