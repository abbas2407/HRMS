import 'dotenv/config';
import { pool } from './connection';
import { createTenantSchema } from './schema-manager';
import bcrypt from 'bcryptjs';

async function seed() {
  const client = await pool.connect();
  try {
    const { rows: [plan] } = await client.query(`SELECT id FROM plans WHERE name='Trial' LIMIT 1`);
    if (!plan) throw new Error('Run migrate.ts first');

    const slug = 'demo-001';
    const schemaName = 'tenant_demo';
    const adminEmail = 'hr@demo.com';

    // Create tenant with all features
    const allFeatures = JSON.stringify([
      'employees', 'announcements', 'performance', 'training', 'expenses', 
      'grievances', 'recruitment', 'surveys', 'helpdesk', 'timesheet', 
      'vault', 'onboarding', 'attendance', 'geofence', 'leave', 
      'payroll', 'compliance', 'reports', 'api'
    ]);
    await client.query(`
      INSERT INTO tenants (name, slug, schema_name, plan_id, status, trial_ends_at, admin_email, features)
      VALUES ('Demo Company', $1, $2, $3, 'TRIAL', NOW() + INTERVAL '14 days', $4, $5)
      ON CONFLICT (slug) DO UPDATE SET features = EXCLUDED.features
    `, [slug, schemaName, plan.id, adminEmail, allFeatures]);

    // Provision tenant schema (also seeds leave types, shifts, letter templates)
    await createTenantSchema(schemaName);

    // HR Admin user
    const hash = await bcrypt.hash('Demo@123', 12);
    await client.query(`
      INSERT INTO "${schemaName}".users (email, password_hash, role)
      VALUES ($1, $2, 'HR_ADMIN')
      ON CONFLICT (email) DO NOTHING
    `, [adminEmail, hash]);

    // Manager user
    const managerHash = await bcrypt.hash('Demo@123', 12);
    await client.query(`
      INSERT INTO "${schemaName}".users (email, password_hash, role)
      VALUES ('manager@demo.com', $1, 'MANAGER')
      ON CONFLICT (email) DO NOTHING
    `, [managerHash]);

    // Departments
    const depts = ['Engineering', 'Human Resources', 'Finance', 'Sales', 'Operations', 'Marketing'];
    for (const name of depts) {
      await client.query(`
        INSERT INTO "${schemaName}".departments (name)
        VALUES ($1) ON CONFLICT (name) DO NOTHING
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
        VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING
      `, [d.name, d.grade, d.level]);
    }

    // Default shift
    await client.query(`
      INSERT INTO "${schemaName}".shifts (name, start_time, end_time, grace_minutes, week_offs)
      VALUES ('General Shift', '09:00', '18:00', 15, '[0,6]')
      ON CONFLICT (name) DO NOTHING
    `);

    // Night shift
    await client.query(`
      INSERT INTO "${schemaName}".shifts (name, start_time, end_time, grace_minutes, week_offs, is_night_shift)
      VALUES ('Night Shift', '21:00', '06:00', 15, '[0,6]', true)
      ON CONFLICT (name) DO NOTHING
    `);

    // Office location (lat/lng required)
    await client.query(`
      INSERT INTO "${schemaName}".office_locations (name, address, lat, lng, radius_meters)
      VALUES ('Head Office', '123 Business Park, Mumbai, Maharashtra, India', 19.0760, 72.8777, 200)
      ON CONFLICT DO NOTHING
    `);

    // Sample employees — inserted after departments/designations so subqueries resolve
    const employees = [
      { code: 'EMP001', first: 'Rahul',   last: 'Sharma',  email: 'rahul.sharma@demo.com',  dept: 'Engineering',    desig: 'Senior Software Engineer', joining: '2023-03-15', type: 'FULL_TIME' },
      { code: 'EMP002', first: 'Priya',   last: 'Patel',   email: 'priya.patel@demo.com',   dept: 'Human Resources', desig: 'HR Executive',            joining: '2023-06-01', type: 'FULL_TIME' },
      { code: 'EMP003', first: 'Amit',    last: 'Singh',   email: 'amit.singh@demo.com',    dept: 'Finance',        desig: 'Accountant',               joining: '2022-11-10', type: 'FULL_TIME' },
      { code: 'EMP004', first: 'Sneha',   last: 'Nair',    email: 'sneha.nair@demo.com',    dept: 'Sales',          desig: 'Sales Executive',          joining: '2024-01-08', type: 'FULL_TIME' },
      { code: 'EMP005', first: 'Vikram',  last: 'Mehta',   email: 'vikram.mehta@demo.com',  dept: 'Engineering',    desig: 'Team Lead',                joining: '2022-07-20', type: 'FULL_TIME' },
      { code: 'EMP006', first: 'Anjali',  last: 'Desai',   email: 'anjali.desai@demo.com',  dept: 'Marketing',      desig: 'Sales Manager',            joining: '2023-09-01', type: 'FULL_TIME' },
      { code: 'EMP007', first: 'Karan',   last: 'Gupta',   email: 'karan.gupta@demo.com',   dept: 'Operations',     desig: 'Operations Manager',       joining: '2022-04-01', type: 'FULL_TIME' },
      { code: 'EMP008', first: 'Divya',   last: 'Reddy',   email: 'divya.reddy@demo.com',   dept: 'Engineering',    desig: 'Software Engineer',        joining: '2024-06-15', type: 'FULL_TIME' },
    ];

    for (const e of employees) {
      await client.query(`
        INSERT INTO "${schemaName}".employees
          (employee_code, first_name, last_name, email, department_id, designation_id, joining_date, employment_type, status)
        SELECT $1, $2, $3, $4, d.id, des.id, $7, $8, 'ACTIVE'
        FROM "${schemaName}".departments d
        JOIN "${schemaName}".designations des ON des.name = $6
        WHERE d.name = $5
        ON CONFLICT (employee_code) DO NOTHING
      `, [e.code, e.first, e.last, e.email, e.dept, e.desig, e.joining, e.type]);
    }

    // Employee user accounts (role: EMPLOYEE) linked by email
    const empHash = await bcrypt.hash('Demo@123', 12);
    for (const e of employees) {
      await client.query(`
        INSERT INTO "${schemaName}".users (email, password_hash, role)
        VALUES ($1, $2, 'EMPLOYEE')
        ON CONFLICT (email) DO NOTHING
      `, [e.email, empHash]);
    }

    // National holidays for current + next year
    const year = new Date().getFullYear();
    const holidays = [
      { name: 'New Year\'s Day',          date: `${year}-01-01`, type: 'NATIONAL' },
      { name: 'Republic Day',             date: `${year}-01-26`, type: 'NATIONAL' },
      { name: 'Holi',                     date: `${year}-03-14`, type: 'NATIONAL' },
      { name: 'Good Friday',              date: `${year}-04-18`, type: 'NATIONAL' },
      { name: 'Ambedkar Jayanti',         date: `${year}-04-14`, type: 'NATIONAL' },
      { name: 'Eid ul-Fitr',              date: `${year}-03-31`, type: 'NATIONAL' },
      { name: 'Independence Day',         date: `${year}-08-15`, type: 'NATIONAL' },
      { name: 'Gandhi Jayanti',           date: `${year}-10-02`, type: 'NATIONAL' },
      { name: 'Dussehra',                 date: `${year}-10-02`, type: 'COMPANY'  },
      { name: 'Diwali',                   date: `${year}-10-20`, type: 'NATIONAL' },
      { name: 'Christmas',                date: `${year}-12-25`, type: 'NATIONAL' },
      // Next year
      { name: 'New Year\'s Day',          date: `${year + 1}-01-01`, type: 'NATIONAL' },
      { name: 'Republic Day',             date: `${year + 1}-01-26`, type: 'NATIONAL' },
    ];

    for (const h of holidays) {
      await client.query(`
        INSERT INTO "${schemaName}".holidays (name, date, type)
        SELECT $1::varchar, $2::date, $3::"${schemaName}".holiday_type
        WHERE NOT EXISTS (
          SELECT 1 FROM "${schemaName}".holidays WHERE date = $2::date AND name = $1::varchar
        )
      `, [h.name, h.date, h.type]);
    }

    console.log('✅ Demo company seeded');
    console.log('   HR Admin  : hr@demo.com / Demo@123');
    console.log('   Manager   : manager@demo.com / Demo@123');
    console.log('   Employees : rahul.sharma@demo.com ... divya.reddy@demo.com / Demo@123');
    console.log(`   Depts     : ${depts.length}`);
    console.log(`   Desigs    : ${desigs.length}`);
    console.log(`   Employees : ${employees.length}`);
    console.log(`   Holidays  : ${holidays.length}`);
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
