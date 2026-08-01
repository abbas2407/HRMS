import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as publicSchema from './public.schema';

const dbUrl = process.env.DATABASE_URL;
let poolConfig: any = {};

if (dbUrl) {
  poolConfig = { connectionString: dbUrl };
}


const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema: publicSchema });
export { pool };
