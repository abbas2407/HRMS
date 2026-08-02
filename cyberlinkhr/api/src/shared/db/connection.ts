import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as publicSchema from './public.schema';

function parseDatabaseUrl(url: string): any {
  try {
    new URL(url);
    return { connectionString: url };
  } catch (e) {
    const match = url.match(/^(?:postgresql|postgres):\/\/([^:]+):(.*)@([^@\/]+)\/(.+)$/);
    if (match) {
      const [, user, password, hostPort, database] = match;
      const [host, port] = hostPort.split(':');
      return {
        user: decodeURIComponent(user),
        password: decodeURIComponent(password),
        host,
        port: port ? parseInt(port, 10) : 5432,
        database,
      };
    }
    return { connectionString: url };
  }
}

const dbUrl = process.env.DATABASE_URL;
let poolConfig: any = {};

if (dbUrl) {
  poolConfig = parseDatabaseUrl(dbUrl);
}

const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema: publicSchema });
export { pool };
