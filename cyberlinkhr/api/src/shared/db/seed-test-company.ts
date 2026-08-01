import 'dotenv/config';
import { pool } from './connection';
import { createTenantSchema } from './schema-manager';
import bcrypt from 'bcryptjs';

async function seed() {
  const client = await pool.connect();
  try {
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

    // HR Admin user
    const hash = await bcrypt.hash('Demo@123', 12);
    await client.query(`
      INSERT INTO "${schemaName}".users (email, password_hash, role)
      VALUES ($1, $2, 'HR_ADMIN')
      ON CONFLICT (email) DO NOTHING
    `, [adminEmail, hash]);

    // Departments
    const depts = ['Engineering', 'Human Resources', 'Finance', 'Sales', 'Operations', 'Marketing'];
    for (const name of depts) {
      await client.query(`
        INSERT INTO "${schemaName}".departments (name)
        VALUES ($1) ON CONFLICT DO NOTHING
      `, [name]);
    }

    // Designations
    const desigs = [
      { name: 'Chief Executive Officer', grade: 'L10', level: 10 },
      { name: 'Engineering Manager', grade: 'L7', level: 7 },
      { name: 'Senior Software Engineer', grade: 'L5', level: 5 },
      { name: 'Software Engineer', grade: 'L4', level: 4 },
      { name: 'Junior Engineer', grade: 'L3', level: 3 },
      { name: 'HR Manager', grade: 'L6', level: 6 },
      { name: 'HR Executive', grade: 'L3', level: 3 },
      { name: 'Finance Manager', grade: 'L6', level: 6 },
      { name: 'Accountant', grade: 'L3', level: 3 },
      { name: 'Sales Manager', grade: 'L6', level: 6 },
      { name: 'Sales Executive', grade: 'L3', level: 3 },
      { name: 'Operations Manager', grade: 'L6', level: 6 },
      { name: 'Team Lead', grade: 'L5', level: 5 },
      { name: 'Intern', grade: 'L1', level: 1 },
    ];
    for (const d of desigs) {
      await client.query(`
        INSERT INTO "${schemaName}".designations (name, grade, level)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
      `, [d.name, d.grade, d.level]);
    }

    // Default shift
    await client.query(`
      INSERT INTO "${schemaName}".shifts (name, start_time, end_time, grace_minutes, week_offs)
      VALUES ('General Shift', '09:00', '18:00', 15, '[0,6]')
      ON CONFLICT DO NOTHING
    `);

    // Office location (lat/lng required)
    await client.query(`
      INSERT INTO "${schemaName}".office_locations (name, address, lat, lng, radius_meters)
      VALUES ('Head Office', '123 Business Park, Mumbai, Maharashtra, India', 19.0760, 72.8777, 200)
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Demo company seeded');
    console.log('   Slug      : demo');
    console.log('   Email     : hr@demo.com');
    console.log('   Password  : Demo@123');
    console.log(`   Depts     : ${depts.length}`);
    console.log(`   Desigs    : ${desigs.length}`);
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
