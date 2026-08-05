import 'dotenv/config';
import { pool } from './connection';
import bcrypt from 'bcryptjs';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running public schema migrations...');

    const { rows: typeExists } = await client.query(`
      SELECT 1 FROM pg_type WHERE typname = 'tenant_status'
    `);
    if (typeExists.length === 0) {
      await client.query(`
        CREATE TYPE tenant_status AS ENUM (
          'TRIAL','ACTIVE','EXPIRED','TRIAL_EXPIRED','SUSPENDED','CANCELLED'
        )
      `);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_employees INTEGER,
        features JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    // Deduplicate existing plans and add UNIQUE constraint if missing
    await client.query(`
      DELETE FROM plans p1
      USING plans p2
      WHERE p1.id > p2.id AND p1.name = p2.name;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'plans_name_key' AND conrelid = 'plans'::regclass
        ) THEN
          ALTER TABLE plans ADD CONSTRAINT plans_name_key UNIQUE (name);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        schema_name VARCHAR(100) NOT NULL UNIQUE,
        plan_id UUID REFERENCES plans(id),
        status tenant_status DEFAULT 'TRIAL' NOT NULL,
        trial_starts_at TIMESTAMPTZ,
        trial_ends_at TIMESTAMPTZ,
        subscription_starts_at TIMESTAMPTZ,
        subscription_ends_at TIMESTAMPTZ,
        employee_count INTEGER DEFAULT 0,
        logo_url TEXT,
        primary_color VARCHAR(7),
        pf_number VARCHAR(30),
        esic_number VARCHAR(30),
        pt_state VARCHAR(50),
        admin_email VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        created_by UUID REFERENCES vendor_users(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
        notes TEXT,
        recorded_by UUID REFERENCES vendor_users(id),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_user_id UUID REFERENCES vendor_users(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id UUID,
        details TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        target_all BOOLEAN DEFAULT TRUE,
        target_tenant_ids JSONB DEFAULT '[]',
        sent_by UUID REFERENCES vendor_users(id),
        sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // Seed default plans
    await client.query(`
      INSERT INTO plans (name, price_monthly, max_employees, features)
      VALUES
        ('Trial', 0, 10, '["employees","attendance","leave"]'),
        ('Starter', 999, 25, '["employees","attendance","leave","payroll"]'),
        ('Growth', 2499, 100, '["employees","attendance","leave","payroll","compliance","reports"]'),
        ('Enterprise', 4999, NULL, '["employees","attendance","leave","payroll","compliance","reports","api"]')
      ON CONFLICT (name) DO NOTHING
    `);

    // Seed default vendor admin
    const hash = await bcrypt.hash('Admin@123', 12);
    await client.query(`
      INSERT INTO vendor_users (name, email, password_hash)
      VALUES ('Vendor Admin', 'admin@cyberlink.co.in', $1)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE
    `, [hash]);

    console.log('✅ Public schema ready');
    console.log('✅ Default vendor admin: admin@cyberlink.co.in / Admin@123');
    console.log('✅ 4 plans seeded: Trial, Starter, Growth, Enterprise');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
