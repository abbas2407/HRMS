import 'dotenv/config';
import { pool } from './connection';

async function run() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query('SELECT schema_name FROM tenants');
    console.log(`Found ${tenants.length} tenants to migrate.`);

    for (const t of tenants) {
      const schemaName = t.schema_name;
      console.log(`Migrating schema: ${schemaName}...`);

      await client.query('BEGIN');

      // 1. custom_fields
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".custom_fields (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(100) NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          label VARCHAR(100) NOT NULL,
          field_type VARCHAR(50) NOT NULL,
          options JSONB DEFAULT '[]',
          required BOOLEAN DEFAULT FALSE NOT NULL,
          position VARCHAR(100),
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          UNIQUE(module, field_name)
        )
      `);

      // 2. custom_field_values
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".custom_field_values (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          record_id UUID NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          value TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          UNIQUE(record_id, field_name)
        )
      `);

      // 3. workflows
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".workflows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(100) NOT NULL UNIQUE,
          name VARCHAR(200) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 4. workflow_states
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".workflow_states (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID REFERENCES "${schemaName}".workflows(id) ON DELETE CASCADE,
          state_name VARCHAR(100) NOT NULL,
          style VARCHAR(50) DEFAULT 'blue' NOT NULL,
          is_initial BOOLEAN DEFAULT FALSE NOT NULL,
          is_final BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          UNIQUE(workflow_id, state_name)
        )
      `);

      // 5. workflow_transitions
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".workflow_transitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID REFERENCES "${schemaName}".workflows(id) ON DELETE CASCADE,
          from_state VARCHAR(100) NOT NULL,
          to_state VARCHAR(100) NOT NULL,
          action_label VARCHAR(100) NOT NULL,
          allowed_roles JSONB DEFAULT '[]' NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 6. workflow_logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".workflow_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          record_id UUID NOT NULL,
          state VARCHAR(100) NOT NULL,
          transitioned_by UUID REFERENCES "${schemaName}".users(id),
          transitioned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          comment TEXT
        )
      `);

      // 7. permissions
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".permissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role VARCHAR(50) NOT NULL,
          module VARCHAR(100) NOT NULL,
          can_read BOOLEAN DEFAULT TRUE NOT NULL,
          can_write BOOLEAN DEFAULT FALSE NOT NULL,
          can_create BOOLEAN DEFAULT FALSE NOT NULL,
          can_delete BOOLEAN DEFAULT FALSE NOT NULL,
          can_submit BOOLEAN DEFAULT FALSE NOT NULL,
          can_cancel BOOLEAN DEFAULT FALSE NOT NULL,
          can_export BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          UNIQUE(role, module)
        )
      `);

      // 8. versions
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(100) NOT NULL,
          record_id UUID NOT NULL,
          data_before JSONB,
          data_after JSONB,
          changed_by UUID REFERENCES "${schemaName}".users(id),
          changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 9. print_formats
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".print_formats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(100) NOT NULL,
          name VARCHAR(200) NOT NULL,
          html_template TEXT NOT NULL,
          is_default BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 10. notification_rules
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".notification_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(100) NOT NULL,
          event VARCHAR(50) NOT NULL,
          condition TEXT,
          recipients JSONB DEFAULT '[]' NOT NULL,
          email_template_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 11. email_templates
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".email_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL UNIQUE,
          subject VARCHAR(300) NOT NULL,
          html_body TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 12. email_alert_rules
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".email_alert_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL,
          doctype VARCHAR(100) NOT NULL,
          event VARCHAR(50) NOT NULL,
          condition TEXT,
          recipients JSONB DEFAULT '[]' NOT NULL,
          subject_template VARCHAR(300) NOT NULL,
          body_template TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 13. saved_reports
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".saved_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL,
          type VARCHAR(50) NOT NULL,
          doctype VARCHAR(100) NOT NULL,
          query_or_script TEXT NOT NULL,
          columns JSONB DEFAULT '[]' NOT NULL,
          filters JSONB DEFAULT '[]' NOT NULL,
          is_standard BOOLEAN DEFAULT FALSE NOT NULL,
          created_by UUID REFERENCES "${schemaName}".users(id),
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // 12. Add doc_status / current_state columns if missing
      await client.query(`
        ALTER TABLE "${schemaName}".employees 
        ADD COLUMN IF NOT EXISTS doc_status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        ADD COLUMN IF NOT EXISTS current_state VARCHAR(100);
      `);

      await client.query(`
        ALTER TABLE "${schemaName}".employees 
        ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20),
        ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS probation_days INTEGER,
        ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
        ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS prior_experience_months INTEGER,
        ADD COLUMN IF NOT EXISTS shift_start_time VARCHAR(10),
        ADD COLUMN IF NOT EXISTS shift_end_time VARCHAR(10),
        ADD COLUMN IF NOT EXISTS photo_url TEXT;
      `);

      await client.query(`
        ALTER TABLE "${schemaName}".leave_requests 
        ADD COLUMN IF NOT EXISTS doc_status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        ADD COLUMN IF NOT EXISTS current_state VARCHAR(100);
      `);

      await client.query(`
        ALTER TABLE "${schemaName}".expense_claims 
        ADD COLUMN IF NOT EXISTS doc_status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        ADD COLUMN IF NOT EXISTS current_state VARCHAR(100);
      `);

      await client.query(`
        ALTER TABLE "${schemaName}".assets 
        ADD COLUMN IF NOT EXISTS doc_status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        ADD COLUMN IF NOT EXISTS current_state VARCHAR(100);
      `);

      await client.query(`
        ALTER TABLE "${schemaName}".grievances 
        ADD COLUMN IF NOT EXISTS doc_status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        ADD COLUMN IF NOT EXISTS current_state VARCHAR(100);
      `);

      // Seed default permissions
      await client.query(`
        INSERT INTO "${schemaName}".permissions (role, module, can_read, can_write, can_create, can_delete, can_submit, can_cancel, can_export)
        VALUES 
          ('HR_ADMIN', 'employee', true, true, true, true, true, true, true),
          ('HR_ADMIN', 'leave', true, true, true, true, true, true, true),
          ('HR_ADMIN', 'payroll', true, true, true, true, true, true, true),
          ('HR_ADMIN', 'compliance', true, true, true, true, true, true, true),
          ('HR_ADMIN', 'assets', true, true, true, true, true, true, true),
          ('HR_ADMIN', 'grievances', true, true, true, true, true, true, true),
          ('MANAGER', 'employee', true, false, false, false, false, false, false),
          ('MANAGER', 'leave', true, true, true, false, true, false, false),
          ('MANAGER', 'payroll', false, false, false, false, false, false, false),
          ('EMPLOYEE', 'employee', true, false, false, false, false, false, false),
          ('EMPLOYEE', 'leave', true, true, true, false, false, false, false),
          ('ACCOUNTANT', 'payroll', true, true, true, false, true, false, true),
          ('AUDITOR', 'employee', true, false, false, false, false, false, false),
          ('AUDITOR', 'payroll', true, false, false, false, false, false, false),
          ('AUDITOR', 'compliance', true, false, false, false, false, false, false)
        ON CONFLICT (role, module) DO NOTHING
      `);

      // GIN tsvector indexes for global search
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_employees_fts 
        ON "${schemaName}".employees 
        USING GIN (to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(employee_code,'') || ' ' || coalesce(email,'')))
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_departments_fts 
        ON "${schemaName}".departments 
        USING GIN (to_tsvector('simple', coalesce(name,'')))
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_designations_fts 
        ON "${schemaName}".designations 
        USING GIN (to_tsvector('simple', coalesce(name,'')))
      `);

      // email_alert_rules
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".email_alert_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL,
          doctype VARCHAR(100) NOT NULL,
          event VARCHAR(50) NOT NULL,
          condition TEXT,
          recipients JSONB DEFAULT '[]' NOT NULL,
          subject_template VARCHAR(300) NOT NULL,
          body_template TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // saved_reports
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".saved_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL,
          type VARCHAR(50) NOT NULL,
          doctype VARCHAR(100) NOT NULL,
          query_or_script TEXT NOT NULL,
          columns JSONB DEFAULT '[]' NOT NULL,
          filters JSONB DEFAULT '[]' NOT NULL,
          is_standard BOOLEAN DEFAULT FALSE NOT NULL,
          created_by UUID REFERENCES "${schemaName}".users(id),
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      // print_formats
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".print_formats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(100) NOT NULL,
          name VARCHAR(200) NOT NULL,
          html_template TEXT NOT NULL,
          is_default BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `);

      await client.query('COMMIT');

      console.log(`Schema ${schemaName} migrated successfully.`);
    }
    console.log('✓ All schemas migrated.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
