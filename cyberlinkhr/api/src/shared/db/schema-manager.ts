import { pool } from './connection';

export async function createTenantSchema(schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);

    const createEnumIfNotExists = async (typeName: string, values: string[]) => {
      const { rows } = await client.query(
        `SELECT 1 FROM pg_type t 
         JOIN pg_namespace n ON t.typnamespace = n.oid 
         WHERE t.typname = $1 AND n.nspname = $2`,
        [typeName, schemaName]
      );
      if (rows.length === 0) {
        const enumValues = values.map(v => `'${v}'`).join(',');
        await client.query(`CREATE TYPE "${schemaName}"."${typeName}" AS ENUM (${enumValues})`);
      }
    };

    await createEnumIfNotExists('gender', ['MALE', 'FEMALE', 'OTHER']);
    await createEnumIfNotExists('employment_type', ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
    await createEnumIfNotExists('employee_status', ['ACTIVE', 'INACTIVE', 'SEPARATED']);
    await createEnumIfNotExists('attendance_status', ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'LEAVE', 'HOLIDAY', 'WEEK_OFF']);
    await createEnumIfNotExists('attendance_source', ['WEB', 'MOBILE', 'BIOMETRIC', 'MANUAL']);
    await createEnumIfNotExists('payroll_run_status', ['DRAFT', 'LOCKED', 'DISBURSED']);
    await createEnumIfNotExists('leave_request_status', ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
    await createEnumIfNotExists('holiday_type', ['NATIONAL', 'COMPANY', 'OPTIONAL']);
    await createEnumIfNotExists('user_role', ['HR_ADMIN', 'MANAGER', 'EMPLOYEE']);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        parent_id UUID,
        head_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".designations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        grade VARCHAR(50),
        level INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_code VARCHAR(20) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        dob DATE,
        gender "${schemaName}".gender,
        pan_number TEXT,
        aadhaar_number TEXT,
        bank_account TEXT,
        bank_ifsc VARCHAR(11),
        bank_name VARCHAR(100),
        department_id UUID REFERENCES "${schemaName}".departments(id),
        designation_id UUID REFERENCES "${schemaName}".designations(id),
        manager_id UUID,
        grade VARCHAR(50),
        cost_centre VARCHAR(100),
        joining_date DATE NOT NULL,
        confirmation_date DATE,
        separation_date DATE,
        employment_type "${schemaName}".employment_type DEFAULT 'FULL_TIME',
        work_location VARCHAR(100),
        status "${schemaName}".employee_status DEFAULT 'ACTIVE' NOT NULL,
        uan_number VARCHAR(12),
        esic_ip_number VARCHAR(17),
        is_geo_exempt BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        grace_minutes INTEGER DEFAULT 10,
        is_night_shift BOOLEAN DEFAULT FALSE,
        week_offs JSONB DEFAULT '[0,6]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        shift_id UUID REFERENCES "${schemaName}".shifts(id) NOT NULL,
        effective_from DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".office_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        address TEXT,
        lat DECIMAL(10,7) NOT NULL,
        lng DECIMAL(10,7) NOT NULL,
        radius_meters INTEGER DEFAULT 100,
        ip_whitelist JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".attendance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        date DATE NOT NULL,
        punch_in TIMESTAMPTZ,
        punch_out TIMESTAMPTZ,
        working_hours DECIMAL(5,2),
        punch_in_lat DECIMAL(10,7),
        punch_in_lng DECIMAL(10,7),
        punch_in_ip VARCHAR(45),
        office_location_id UUID REFERENCES "${schemaName}".office_locations(id),
        geo_distance_meters DECIMAL(8,2),
        status "${schemaName}".attendance_status DEFAULT 'PRESENT',
        is_late BOOLEAN DEFAULT FALSE,
        late_by_minutes INTEGER DEFAULT 0,
        overtime_minutes INTEGER DEFAULT 0,
        source "${schemaName}".attendance_source DEFAULT 'WEB',
        regularised_by UUID,
        regularised_at TIMESTAMPTZ,
        remarks TEXT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS attendance_date_idx ON "${schemaName}".attendance_logs(date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS attendance_emp_date_idx ON "${schemaName}".attendance_logs(employee_id, date)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".regularisation_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        date DATE NOT NULL,
        requested_in VARCHAR(5),
        requested_out VARCHAR(5),
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        reviewed_by UUID,
        review_comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        reviewed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".leave_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE,
        max_days_per_year INTEGER,
        min_notice_days INTEGER DEFAULT 0,
        accrual_per_month DECIMAL(5,2) DEFAULT 0,
        carry_forward_cap INTEGER,
        is_paid BOOLEAN DEFAULT TRUE,
        requires_approval BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".leave_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        leave_type_id UUID REFERENCES "${schemaName}".leave_types(id) NOT NULL,
        year INTEGER NOT NULL,
        balance DECIMAL(6,2) DEFAULT 0,
        consumed DECIMAL(6,2) DEFAULT 0,
        tentative DECIMAL(6,2) DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        leave_type_id UUID REFERENCES "${schemaName}".leave_types(id) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_half_day BOOLEAN DEFAULT FALSE,
        half_day_session VARCHAR(2),
        days_count DECIMAL(5,2),
        reason TEXT,
        status "${schemaName}".leave_request_status DEFAULT 'PENDING' NOT NULL,
        reviewed_by UUID,
        review_comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        reviewed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        name VARCHAR(200) NOT NULL,
        type "${schemaName}".holiday_type DEFAULT 'NATIONAL',
        state VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".salary_structures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        basic_pct DECIMAL(5,2) DEFAULT 50,
        hra_pct DECIMAL(5,2) DEFAULT 20,
        special_pct DECIMAL(5,2) DEFAULT 30,
        components JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".employee_salary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        structure_id UUID REFERENCES "${schemaName}".salary_structures(id),
        gross DECIMAL(12,2) NOT NULL,
        effective_from DATE NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".payroll_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status "${schemaName}".payroll_run_status DEFAULT 'DRAFT' NOT NULL,
        total_gross DECIMAL(14,2),
        total_lop DECIMAL(14,2),
        total_net DECIMAL(14,2),
        total_pf_employee DECIMAL(14,2),
        total_pf_employer DECIMAL(14,2),
        total_esic_employee DECIMAL(14,2),
        total_esic_employer DECIMAL(14,2),
        total_pt DECIMAL(14,2),
        total_tds DECIMAL(14,2),
        locked_at TIMESTAMPTZ,
        locked_by UUID,
        disbursed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".payslips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payroll_run_id UUID REFERENCES "${schemaName}".payroll_runs(id) NOT NULL,
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        working_days INTEGER,
        present_days DECIMAL(5,2),
        lop_days DECIMAL(5,2),
        gross_salary DECIMAL(12,2),
        earned_gross DECIMAL(12,2),
        basic DECIMAL(12,2),
        hra DECIMAL(12,2),
        special_allowance DECIMAL(12,2),
        other_earnings JSONB DEFAULT '[]',
        lop_amount DECIMAL(12,2),
        pf_employee DECIMAL(12,2),
        pf_employer DECIMAL(12,2),
        esic_employee DECIMAL(12,2),
        esic_employer DECIMAL(12,2),
        professional_tax DECIMAL(12,2),
        tds DECIMAL(12,2),
        other_deductions JSONB DEFAULT '[]',
        total_deductions DECIMAL(12,2),
        net_salary DECIMAL(12,2),
        pdf_url TEXT,
        email_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        doc_type VARCHAR(50) NOT NULL,
        file_url TEXT NOT NULL,
        file_name VARCHAR(255),
        file_size INTEGER,
        uploaded_by UUID,
        verified_by UUID,
        verified_at TIMESTAMPTZ,
        expiry_date DATE,
        notes TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".employee_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        changed_by UUID,
        changed_by_name VARCHAR(200),
        changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role "${schemaName}".user_role DEFAULT 'EMPLOYEE' NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        link_path VARCHAR(300),
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES "${schemaName}".users(id),
        user_email VARCHAR(200),
        user_role VARCHAR(30),
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100),
        entity_id VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(10) DEFAULT 'expo',
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".company_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        target_type VARCHAR(20) DEFAULT 'ALL' NOT NULL,
        department_id UUID REFERENCES "${schemaName}".departments(id),
        is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
        expires_at TIMESTAMPTZ,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".letter_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        html_body TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".generated_letters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        template_id UUID REFERENCES "${schemaName}".letter_templates(id),
        type VARCHAR(50) NOT NULL,
        merged_html TEXT NOT NULL,
        generated_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        asset_code VARCHAR(50) NOT NULL UNIQUE,
        category VARCHAR(50) NOT NULL,
        brand VARCHAR(100),
        serial_number VARCHAR(100),
        purchase_date DATE,
        purchase_value DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".asset_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID REFERENCES "${schemaName}".assets(id) NOT NULL,
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        assigned_at DATE NOT NULL,
        returned_at DATE,
        condition VARCHAR(50) DEFAULT 'GOOD',
        remarks TEXT,
        assigned_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // Seed default letter templates
    const letterBase = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;padding:48px;color:#1e293b;font-size:14px;line-height:1.8;max-width:720px;margin:auto}
.hdr{border-bottom:3px solid #2563EB;padding-bottom:14px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:flex-end}
.co{font-size:20px;font-weight:800;color:#2563EB}.ref{font-size:12px;color:#64748b}
h2{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:.05em;margin-bottom:24px}
p{margin:0 0 14px}.sig{margin-top:60px}.bold{font-weight:700}
</style></head><body>
<div class="hdr"><div class="co">{{COMPANY_NAME}}</div><div class="ref">Ref: {{REF_NUMBER}}<br>Date: {{TODAY_DATE}}</div></div>`;

    await client.query(`
      INSERT INTO "${schemaName}".letter_templates (type, name, html_body) VALUES
      ('OFFER', 'Offer Letter', $1),
      ('APPOINTMENT', 'Appointment Letter', $2),
      ('RELIEVING', 'Relieving Letter', $3),
      ('EXPERIENCE', 'Experience Letter', $4),
      ('INCREMENT', 'Increment Letter', $5),
      ('WARNING', 'Warning Letter', $6)
    `, [
      letterBase + `<h2>Offer Letter</h2>
<p>Dear <span class="bold">{{FIRST_NAME}}</span>,</p>
<p>We are pleased to offer you the position of <span class="bold">{{DESIGNATION}}</span> in our <span class="bold">{{DEPARTMENT}}</span> department at <span class="bold">{{COMPANY_NAME}}</span>.</p>
<p>Your date of joining is proposed as <span class="bold">{{JOINING_DATE}}</span>. Your monthly gross compensation will be <span class="bold">{{GROSS_SALARY}}</span>, subject to applicable statutory deductions.</p>
<p>This offer is conditional upon satisfactory completion of background verification and submission of required documents.</p>
<p>Kindly sign and return a copy of this letter as your acceptance.</p>
<div class="sig"><p>Yours sincerely,</p><br><br><p class="bold">Authorised Signatory<br>{{COMPANY_NAME}}</p></div>
</body></html>`,

      letterBase + `<h2>Appointment Letter</h2>
<p>Dear <span class="bold">{{FIRST_NAME}}</span>,</p>
<p>With reference to your joining our organization, we are pleased to confirm your appointment as <span class="bold">{{DESIGNATION}}</span> in the <span class="bold">{{DEPARTMENT}}</span> department, effective <span class="bold">{{JOINING_DATE}}</span>.</p>
<p>Your monthly gross salary is <span class="bold">{{GROSS_SALARY}}</span>, subject to statutory deductions as applicable under Indian labour laws.</p>
<p>Your appointment is subject to the terms and conditions of employment as laid out in the Employee Handbook. You are required to maintain the highest standards of conduct, confidentiality, and integrity.</p>
<p>We welcome you to our team and look forward to your valuable contributions.</p>
<div class="sig"><p>Yours sincerely,</p><br><br><p class="bold">HR Department<br>{{COMPANY_NAME}}</p></div>
</body></html>`,

      letterBase + `<h2>Relieving Letter</h2>
<p>To Whom It May Concern,</p>
<p>This is to certify that <span class="bold">{{EMPLOYEE_NAME}}</span> (Employee Code: {{EMPLOYEE_CODE}}) was employed with <span class="bold">{{COMPANY_NAME}}</span> as <span class="bold">{{DESIGNATION}}</span> in the <span class="bold">{{DEPARTMENT}}</span> department from <span class="bold">{{JOINING_DATE}}</span> to <span class="bold">{{LAST_WORKING_DATE}}</span>.</p>
<p>{{FIRST_NAME}} has been relieved from their duties with effect from <span class="bold">{{LAST_WORKING_DATE}}</span> and has completed the exit formalities.</p>
<p>We wish {{FIRST_NAME}} all the best in their future endeavours.</p>
<div class="sig"><p>For <span class="bold">{{COMPANY_NAME}}</span>,</p><br><br><p class="bold">HR Department</p></div>
</body></html>`,

      letterBase + `<h2>Experience Letter</h2>
<p>To Whom It May Concern,</p>
<p>This is to certify that <span class="bold">{{EMPLOYEE_NAME}}</span> (Employee Code: {{EMPLOYEE_CODE}}) has worked with <span class="bold">{{COMPANY_NAME}}</span> as <span class="bold">{{DESIGNATION}}</span> in the <span class="bold">{{DEPARTMENT}}</span> department from <span class="bold">{{JOINING_DATE}}</span> to <span class="bold">{{LAST_WORKING_DATE}}</span>.</p>
<p>During the tenure, {{FIRST_NAME}} has demonstrated professionalism and dedication. We found them to be a sincere and hardworking employee.</p>
<p>We wish {{FIRST_NAME}} every success in their future career.</p>
<div class="sig"><p>For <span class="bold">{{COMPANY_NAME}}</span>,</p><br><br><p class="bold">HR Department</p></div>
</body></html>`,

      letterBase + `<h2>Salary Increment Letter</h2>
<p>Dear <span class="bold">{{FIRST_NAME}}</span>,</p>
<p>We are pleased to inform you that in recognition of your continued contribution and performance, the management has decided to revise your compensation.</p>
<p>Your revised monthly gross salary will be <span class="bold">{{GROSS_SALARY}}</span>, effective from <span class="bold">{{TODAY_DATE}}</span>.</p>
<p>We appreciate your dedication and look forward to your continued excellence.</p>
<div class="sig"><p>Yours sincerely,</p><br><br><p class="bold">HR Department<br>{{COMPANY_NAME}}</p></div>
</body></html>`,

      letterBase + `<h2>Warning Letter</h2>
<p>Dear <span class="bold">{{FIRST_NAME}}</span>,</p>
<p>This letter is being issued to you as a formal warning regarding your conduct/performance as <span class="bold">{{DESIGNATION}}</span> in the <span class="bold">{{DEPARTMENT}}</span> department.</p>
<p>It has been observed that [<em>describe the specific issue or incident here</em>]. This behaviour is contrary to the company's policies and code of conduct.</p>
<p>You are hereby warned that a recurrence of such behaviour may result in further disciplinary action, up to and including termination of employment.</p>
<p>Please treat this matter with utmost seriousness and ensure compliance with company policies going forward.</p>
<div class="sig"><p>Yours sincerely,</p><br><br><p class="bold">HR Department<br>{{COMPANY_NAME}}</p></div>
</body></html>`
    ]);

    // Seed default leave types
    await client.query(`
      INSERT INTO "${schemaName}".leave_types (name, code, max_days_per_year, accrual_per_month, carry_forward_cap, is_paid)
      VALUES
        ('Casual Leave', 'CL', 12, 1.0, 0, true),
        ('Sick Leave', 'SL', 12, 1.0, 0, true),
        ('Earned Leave', 'EL', 18, 1.5, 30, true),
        ('Compensatory Off', 'COMPOFF', NULL, 0, 0, true),
        ('Leave Without Pay', 'LWP', NULL, 0, NULL, false)
      ON CONFLICT (code) DO NOTHING
    `);

    // Default shift
    await client.query(`
      INSERT INTO "${schemaName}".shifts (name, start_time, end_time, grace_minutes, week_offs)
      VALUES ('General Shift', '09:00', '18:00', 15, '[0,6]')
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".expense_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        title VARCHAR(200) NOT NULL,
        total_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        submitted_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES "${schemaName}".users(id),
        reviewed_at TIMESTAMPTZ,
        remarks TEXT,
        reimbursed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".expense_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID REFERENCES "${schemaName}".expense_claims(id) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description VARCHAR(300) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        expense_date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".grievances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        category VARCHAR(50) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
        status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
        assigned_to UUID REFERENCES "${schemaName}".users(id),
        resolution TEXT,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".grievance_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        grievance_id UUID REFERENCES "${schemaName}".grievances(id) NOT NULL,
        author_id UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        comment TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".appraisal_cycles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        period VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".appraisal_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cycle_id UUID REFERENCES "${schemaName}".appraisal_cycles(id) NOT NULL,
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        goals JSONB DEFAULT '[]' NOT NULL,
        self_rating INTEGER,
        self_comments TEXT,
        manager_rating INTEGER,
        manager_comments TEXT,
        status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
        self_submitted_at TIMESTAMPTZ,
        reviewed_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES "${schemaName}".users(id),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE(cycle_id, employee_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".training_programs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        type VARCHAR(50) DEFAULT 'TECHNICAL' NOT NULL,
        description TEXT,
        trainer VARCHAR(200),
        start_date DATE,
        end_date DATE,
        max_capacity INTEGER,
        status VARCHAR(20) DEFAULT 'UPCOMING' NOT NULL,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".training_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_id UUID REFERENCES "${schemaName}".training_programs(id) NOT NULL,
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        enrolled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'ENROLLED' NOT NULL,
        enrolled_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        UNIQUE(program_id, employee_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".help_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number VARCHAR(20) NOT NULL UNIQUE,
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        category VARCHAR(50) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
        status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
        assigned_to UUID REFERENCES "${schemaName}".users(id),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".help_ticket_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID REFERENCES "${schemaName}".help_tickets(id) NOT NULL,
        author_id UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        comment TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        type VARCHAR(20) DEFAULT 'NAMED' NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        deadline DATE,
        target_role VARCHAR(20),
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".survey_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES "${schemaName}".surveys(id) NOT NULL,
        question_text TEXT NOT NULL,
        question_type VARCHAR(30) NOT NULL,
        options JSONB DEFAULT '[]' NOT NULL,
        required BOOLEAN DEFAULT TRUE NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".survey_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES "${schemaName}".surveys(id) NOT NULL,
        respondent_id UUID REFERENCES "${schemaName}".employees(id),
        submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".survey_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        response_id UUID REFERENCES "${schemaName}".survey_responses(id) NOT NULL,
        question_id UUID REFERENCES "${schemaName}".survey_questions(id) NOT NULL,
        answer_text TEXT,
        answer_rating INTEGER,
        answer_choice VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".job_postings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        department_id UUID REFERENCES "${schemaName}".departments(id),
        designation_id UUID REFERENCES "${schemaName}".designations(id),
        job_type VARCHAR(30) DEFAULT 'FULL_TIME' NOT NULL,
        location VARCHAR(200),
        description TEXT,
        requirements TEXT,
        openings INTEGER DEFAULT 1 NOT NULL,
        status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
        closing_date DATE,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".job_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES "${schemaName}".job_postings(id) NOT NULL,
        applicant_name VARCHAR(200) NOT NULL,
        email VARCHAR(200) NOT NULL,
        phone VARCHAR(20),
        resume_url TEXT,
        current_company VARCHAR(200),
        current_role VARCHAR(200),
        total_experience VARCHAR(50),
        notice_period VARCHAR(50),
        expected_salary VARCHAR(100),
        stage VARCHAR(30) DEFAULT 'APPLIED' NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        notes TEXT,
        assigned_to UUID REFERENCES "${schemaName}".users(id),
        applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".interview_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES "${schemaName}".job_applications(id) NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        duration_minutes INTEGER DEFAULT 60 NOT NULL,
        mode VARCHAR(30) DEFAULT 'VIDEO' NOT NULL,
        location VARCHAR(200),
        interviewers JSONB DEFAULT '[]' NOT NULL,
        notes TEXT,
        outcome VARCHAR(30),
        feedback TEXT,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".vault_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        icon VARCHAR(10),
        target_type VARCHAR(20) DEFAULT 'ALL' NOT NULL,
        department_id UUID REFERENCES "${schemaName}".departments(id),
        target_role VARCHAR(30),
        is_archived BOOLEAN DEFAULT FALSE NOT NULL,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".vault_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        folder_id UUID REFERENCES "${schemaName}".vault_folders(id) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        file_name VARCHAR(300) NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER,
        file_type VARCHAR(100),
        version INTEGER DEFAULT 1 NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
        uploaded_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        client_name VARCHAR(200),
        description TEXT,
        billable BOOLEAN DEFAULT TRUE NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        created_by UUID REFERENCES "${schemaName}".users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".timesheet_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES "${schemaName}".employees(id) NOT NULL,
        project_id UUID REFERENCES "${schemaName}".projects(id) NOT NULL,
        entry_date DATE NOT NULL,
        week_start DATE NOT NULL,
        hours DECIMAL(4,2) NOT NULL,
        task_description VARCHAR(500),
        billable BOOLEAN DEFAULT TRUE NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
        submitted_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES "${schemaName}".users(id),
        reviewed_at TIMESTAMPTZ,
        review_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function dropTenantSchema(schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    client.release();
  }
}
