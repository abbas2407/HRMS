import nodemailer from 'nodemailer';
import { sql, eq, and } from 'drizzle-orm';
import { emailAlertRules } from '../db/tenant.schema';

type HookHandler = (doc: any, context: { db: any; req?: any }) => Promise<void>;

const hookRegistry: Record<string, Record<string, HookHandler[]>> = {};

export function registerHook(doctype: string, event: string, handler: HookHandler) {
  if (!hookRegistry[doctype]) {
    hookRegistry[doctype] = {};
  }
  if (!hookRegistry[doctype][event]) {
    hookRegistry[doctype][event] = [];
  }
  hookRegistry[doctype][event].push(handler);
}

export async function runHooks(doctype: string, event: string, doc: any, context: { db: any; req?: any }) {
  const handlers = hookRegistry[doctype]?.[event] || [];
  for (const handler of handlers) {
    await handler(doc, context);
  }
  // Trigger general alert checks
  await checkEmailAlerts(doctype, event, doc, context);
}

export function listRegisteredHooks() {
  const list: { doctype: string; event: string; count: number }[] = [];
  for (const doctype of Object.keys(hookRegistry)) {
    for (const event of Object.keys(hookRegistry[doctype])) {
      list.push({
        doctype,
        event,
        count: hookRegistry[doctype][event].length,
      });
    }
  }
  return list;
}

// Nodemailer transporter helper (loads from settings table or environment)
async function getTransporter(db: any) {
  try {
    const { rows } = await db.execute(`SELECT * FROM company_settings WHERE key = 'smtp_config'`);
    if (rows.length && rows[0].value) {
      const config = JSON.parse(rows[0].value);
      return nodemailer.createTransport({
        host: config.host,
        port: Number(config.port),
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    }
  } catch (e) {
    console.error('Failed to parse SMTP settings, using default transporter:', e);
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT || 587),
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGISTER BUILT-IN HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. Employee beforeSave: validate PAN and IFSC formats
registerHook('employee', 'beforeSave', async (doc) => {
  if (doc.panNumber) {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(doc.panNumber)) {
      throw new Error('Invalid PAN number format.');
    }
  }
  if (doc.bankIfsc) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(doc.bankIfsc)) {
      throw new Error('Invalid IFSC code format.');
    }
  }
});

// 2. Leave afterSave: if status=APPROVED → deduct leave balance
registerHook('leave', 'afterSave', async (doc, { db }) => {
  if (doc.status === 'APPROVED') {
    // Determine number of days
    const start = new Date(doc.startDate);
    const end = new Date(doc.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Deduct from leave_balances
    await db.execute(sql`
      UPDATE leave_balances 
      SET balance = balance - ${days}
      WHERE employee_id = ${doc.employeeId} AND leave_type_id = ${doc.leaveTypeId}
    `);
  }
});

// 3. Leave onStatusChange: send email notification to employee
registerHook('leave', 'onStatusChange', async (doc, { db }) => {
  try {
    const { rows: emps } = await db.execute(sql`SELECT email, first_name FROM employees WHERE id = ${doc.employeeId}`);
    const employee = emps[0];
    if (!employee || !employee.email) return;

    const transporter = await getTransporter(db);
    await transporter.sendMail({
      from: '"CyberlinkHR System" <noreply@cyberlinkhr.com>',
      to: employee.email,
      subject: `Leave Application Status: ${doc.status}`,
      text: `Hello ${employee.first_name},\n\nYour leave application from ${doc.startDate} to ${doc.endDate} has been changed to status: ${doc.status}.\n\nRegards,\nHR Team`,
    });
  } catch (e) {
    console.error('Failed to send leave status email:', e);
  }
});

// 4. Payroll afterSubmit: lock attendance for that month
registerHook('payroll', 'afterSubmit', async (doc, { db }) => {
  // Payroll doc has month and year
  // Lock attendance logs for that period
  await db.execute(sql`
    UPDATE attendance_logs
    SET is_locked = true
    WHERE EXTRACT(MONTH FROM clock_in) = ${doc.month} 
      AND EXTRACT(YEAR FROM clock_in) = ${doc.year}
  `);
});

// 5. Attendance afterSave: if status=ABSENT → check if employee has pending leave, auto-link it
registerHook('attendance', 'afterSave', async (doc, { db }) => {
  if (doc.status === 'ABSENT') {
    const dateStr = new Date(doc.date).toISOString().split('T')[0];
    // Find pending or approved leave for this date
    const { rows: leaves } = await db.execute(sql`
      SELECT id FROM leave_requests
      WHERE employee_id = ${doc.employeeId}
        AND status IN ('PENDING', 'APPROVED')
        AND ${dateStr} BETWEEN start_date AND end_date
      LIMIT 1
    `);
    if (leaves.length) {
      const leaveId = leaves[0].id;
      // Auto link leave to attendance log
      await db.execute(sql`
        UPDATE attendance_logs
        SET leave_request_id = ${leaveId}, notes = 'Auto-linked to leave request'
        WHERE id = ${doc.id}
      `);
    }
  }
});

function renderTemplate(template: string, data: any): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    return path.split('.').reduce((obj: any, key: string) => obj?.[key], data) ?? '';
  });
}

export async function checkEmailAlerts(doctype: string, event: string, doc: any, context: { db: any }) {
  try {
    const { db } = context;
    const activeAlerts = await db.select().from(emailAlertRules).where(and(
      eq(emailAlertRules.doctype, doctype),
      eq(emailAlertRules.event, event),
      eq(emailAlertRules.isActive, true)
    ));

    for (const rule of activeAlerts) {
      let match = true;
      if (rule.condition && rule.condition !== 'true') {
        try {
          const parts = rule.condition.split('=');
          if (parts.length === 2) {
            const key = parts[0].trim();
            const val = parts[1].trim().replace(/['"]/g, '');
            match = String(doc[key]) === String(val);
          }
        } catch (e) {
          console.error(`Failed to evaluate alert condition: ${rule.condition}`, e);
          match = false;
        }
      }

      if (!match) continue;

      let employee = {};
      if (doc.employeeId || doc.employee_id) {
        const empId = doc.employeeId || doc.employee_id;
        const { rows } = await db.execute(sql`SELECT * FROM employees WHERE id = ${empId}`);
        employee = rows[0] || {};
      }

      const templateData = { [doctype]: doc, employee };
      const subject = renderTemplate(rule.subjectTemplate, templateData);
      const body = renderTemplate(rule.bodyTemplate, templateData);

      const emails: string[] = [];
      const recips = rule.recipients || [];
      if (recips.includes('employee_email') && (employee as any).email) {
        emails.push((employee as any).email);
      }
      for (const r of recips) {
        if (r.includes('@')) {
          emails.push(r);
        }
      }

      if (!emails.length) continue;

      const transporter = await getTransporter(db);
      await transporter.sendMail({
        from: '"CyberlinkHR Notifications" <noreply@cyberlinkhr.com>',
        to: emails.join(','),
        subject,
        text: body,
      });
      console.log(`Alert email sent to ${emails.join(',')} for rule: ${rule.name}`);
    }
  } catch (err) {
    console.error('Failed to process email alert rules:', err);
  }
}
