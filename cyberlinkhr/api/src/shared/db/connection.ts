import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as publicSchema from './public.schema';

const dbUrl = process.env.DATABASE_URL;
let poolConfig: any = {};

if (dbUrl) {
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    const match = dbUrl.match(/^(?:postgresql|postgres):\/\/([^:]+):(.*)@([^@\/]+)\/(.+)$/);
    if (match) {
      const [, user, password, hostPort, database] = match;
      const [host, port] = hostPort.split(':');
      poolConfig = {
        user,
        password,
        host,
        port: port ? parseInt(port, 10) : 5432,
        database,
      };
    } else {
      poolConfig = { connectionString: dbUrl };
    }
  } else {
    poolConfig = { connectionString: dbUrl };
  }
}

const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema: publicSchema });
export { pool };
