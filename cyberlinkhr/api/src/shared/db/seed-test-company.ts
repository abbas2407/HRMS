import 'dotenv/config';
import { pool } from './connection';
import { createTenantSchema } from './schema-manager';
import bcrypt from 'bcryptjs';

async function seed() {
  const client = await pool.connect();
  try {
    // Get trial plan
    const { rows: [plan] } = await client.query(`SELECT id FROM plans WHERE name='Trial' LIMIT 1`);
    if (!plan) throw new Error('Run migrate.ts first');

    const slug = 'demo';
    const schemaName = 'tenant_demo';
    const adminEmail = 'hr@demo.com';

    // Create tenant
    await client.query(`
      INSERT INTO tenants (name, slug, schema_name, plan_id, status, trial_ends_at, admin_email)
      VALUES ('Demo Company', $1, $2, $3, 'TRIAL', NOW() + INTERVAL '14 days', $4)
      ON CONFLICT (slug) DO NOTHING
    `, [slug, schemaName, plan.id, adminEmail]);

    // Provision tenant schema
    await createTenantSchema(schemaName);

    // Create HR Admin user in tenant schema
    const hash = await bcrypt.hash('Demo@123', 12);
    await client.query(`
      INSERT INTO "${schemaName}".users (email, password_hash, role)
      VALUES ($1, $2, 'HR_ADMIN')
      ON CONFLICT (email) DO NOTHING
    `, [adminEmail, hash]);

    console.log('✅ Demo company created');
    console.log('   Slug    : demo');
    console.log('   Email   : hr@demo.com');
    console.log('   Password: Demo@123');
    console.log('   Login at: http://localhost:3000/login');
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
