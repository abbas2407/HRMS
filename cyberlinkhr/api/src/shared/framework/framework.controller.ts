import { Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { listRegisteredHooks, runHooks } from './hooks';
import {
  customFields,
  customFieldValues,
  workflows,
  workflowStates,
  workflowTransitions,
  workflowLogs,
  permissions,
  versions,
  printFormats,
  companySettings,
  notifications,
  users,
  emailAlertRules,
  savedReports
} from '../db/tenant.schema';
import puppeteer from 'puppeteer';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. CUSTOMISATION ENGINE (Custom Fields)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getCustomFields(req: Request, res: Response) {
  const { module } = req.params;
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(customFields).where(and(eq(customFields.module, module), eq(customFields.isActive, true)))
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function createCustomField(req: Request, res: Response) {
  const { module, fieldName, label, fieldType, options, required, position } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.insert(customFields).values({
        module,
        fieldName,
        label,
        fieldType,
        options: options || [],
        required: !!required,
        position: position || 'bottom',
        isActive: true,
      }).returning()
    );
    return res.status(201).json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function deleteCustomField(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.update(customFields).set({ isActive: false }).where(eq(customFields.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. WORKFLOW ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getWorkflow(req: Request, res: Response) {
  const { module } = req.params;
  try {
    const data = await req.runInTenant!(async (db) => {
      const [wf] = await db.select().from(workflows).where(eq(workflows.module, module)).limit(1);
      if (!wf) return null;
      const states = await db.select().from(workflowStates).where(eq(workflowStates.workflowId, wf.id));
      const transitions = await db.select().from(workflowTransitions).where(eq(workflowTransitions.workflowId, wf.id));
      return { workflow: wf, states, transitions };
    });
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function transitionWorkflow(req: Request, res: Response) {
  const { module, recordId, toState, actionLabel, comment } = req.body;
  try {
    const userId = req.user?.userId;
    await req.runInTenant!(async (db) => {
      // 1. Log transition
      await db.insert(workflowLogs).values({
        recordId,
        state: toState,
        transitionedBy: userId,
        comment: comment || '',
      });

      // 2. Update record's state in dynamic table
      const tableName = module === 'leave' ? 'leave_requests' : module === 'employee' ? 'employees' : module;
      // Execute parameterized query to update current_state
      await db.execute(sql`
        UPDATE ${sql.identifier(req.tenant!.schemaName)}.${sql.identifier(tableName)}
        SET current_state = ${toState}
        WHERE id = ${recordId}::uuid
      `);
    });
    return res.json({ message: `State updated to ${toState}` });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. ROLE & PERMISSION MATRIX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getPermissions(req: Request, res: Response) {
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(permissions)
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function updatePermission(req: Request, res: Response) {
  const { role, module, canRead, canWrite, canCreate, canDelete, canSubmit, canCancel, canExport } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.insert(permissions).values({
        role, module, canRead, canWrite, canCreate, canDelete, canSubmit, canCancel, canExport
      })
      .onConflictDoUpdate({
        target: [permissions.role, permissions.module],
        set: { canRead, canWrite, canCreate, canDelete, canSubmit, canCancel, canExport }
      })
      .returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. AUDIT TRAIL & VERSION HISTORY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getVersions(req: Request, res: Response) {
  const { module, recordId } = req.params;
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(versions)
        .where(and(eq(versions.module, module), eq(versions.recordId, recordId)))
        .orderBy(desc(versions.changedAt))
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function logRecordVersion(db: any, module: string, recordId: string, before: any, after: any, userId?: string) {
  try {
    await db.insert(versions).values({
      module,
      recordId,
      dataBefore: before || {},
      dataAfter: after || {},
      changedBy: userId,
    });
  } catch (e) {
    console.error('Failed to log version audit trail:', e);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. PRINT FORMATS (Puppeteer PDF Renderer)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function generatePdfFormat(req: Request, res: Response) {
  const { module, id } = req.params;
  try {
    await req.runInTenant!(async (db) => {
      // Find template
      const [template] = await db.select().from(printFormats).where(and(eq(printFormats.module, module), eq(printFormats.isDefault, true))).limit(1);
      const defaultHtml = template ? template.htmlTemplate : `
        <html>
          <body style="font-family: sans-serif; padding: 40px;">
            <h2>CyberlinkHR Print Layout</h2>
            <hr />
            <p><strong>Module:</strong> ${module}</p>
            <p><strong>Record ID:</strong> ${id}</p>
          </body>
        </html>
      `;

      // Launch puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(defaultHtml, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      res.contentType('application/pdf');
      return res.send(pdfBuffer);
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. SYSTEM SETTINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getCompanySettings(req: Request, res: Response) {
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(companySettings)
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function saveCompanySettings(req: Request, res: Response) {
  const { key, value } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.insert(companySettings).values({ key, value })
        .onConflictDoUpdate({
          target: [companySettings.key],
          set: { value, updatedAt: new Date() }
        })
        .returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. DOCUMENT LIFECYCLE HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getHooks(req: Request, res: Response) {
  try {
    const list = listRegisteredHooks();
    return res.json({ data: list });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function triggerHook(req: Request, res: Response) {
  const { doctype, event, doc } = req.body;
  try {
    await req.runInTenant!(async (db) => {
      await runHooks(doctype, event, doc, { db, req });
    });
    return res.json({ message: `Hook ${doctype}:${event} executed successfully.` });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. LINK FIELD RESOLUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function linkSearch(req: Request, res: Response) {
  const { doctype, q = '', limit = '10' } = req.query;
  const searchQ = `%${q}%`;
  const searchLimit = parseInt(limit as string) || 10;

  try {
    const data = await req.runInTenant!(async (db) => {
      const schemaName = req.tenant!.schemaName;
      let rows: any[] = [];

      if (doctype === 'Employee') {
        const res = await db.execute(sql`
          SELECT id, first_name || ' ' || last_name AS label, employee_code AS meta
          FROM ${sql.identifier(schemaName)}.employees
          WHERE first_name ILIKE ${searchQ} OR last_name ILIKE ${searchQ} OR employee_code ILIKE ${searchQ}
          LIMIT ${searchLimit}
        `);
        rows = res.rows;
      } else if (doctype === 'Department') {
        const res = await db.execute(sql`
          SELECT id, name AS label 
          FROM ${sql.identifier(schemaName)}.departments 
          WHERE name ILIKE ${searchQ} 
          LIMIT ${searchLimit}
        `);
        rows = res.rows;
      } else if (doctype === 'Designation') {
        const res = await db.execute(sql`
          SELECT id, name AS label 
          FROM ${sql.identifier(schemaName)}.designations 
          WHERE name ILIKE ${searchQ} 
          LIMIT ${searchLimit}
        `);
        rows = res.rows;
      } else if (doctype === 'LeaveType') {
        const res = await db.execute(sql`
          SELECT id, name AS label 
          FROM ${sql.identifier(schemaName)}.leave_types 
          WHERE name ILIKE ${searchQ} 
          LIMIT ${searchLimit}
        `);
        rows = res.rows;
      } else if (doctype === 'Shift') {
        const res = await db.execute(sql`
          SELECT id, name AS label 
          FROM ${sql.identifier(schemaName)}.shifts 
          WHERE name ILIKE ${searchQ} 
          LIMIT ${searchLimit}
        `);
        rows = res.rows;
      } else if (doctype === 'SalaryStructure') {
        const res = await db.execute(sql`
          SELECT id, name AS label 
          FROM ${sql.identifier(schemaName)}.salary_structures 
          WHERE name ILIKE ${searchQ} 
          LIMIT ${searchLimit}
        `);
        rows = res.rows;
      } else {
        throw new Error('Unsupported doctype for link search.');
      }
      return rows;
    });
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. PRINT FORMAT BUILDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getPrintFormats(req: Request, res: Response) {
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(printFormats)
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function createPrintFormat(req: Request, res: Response) {
  const { module, name, htmlTemplate, isDefault } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.insert(printFormats).values({
        module,
        name,
        htmlTemplate,
        isDefault: !!isDefault,
      }).returning()
    );
    return res.status(201).json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function updatePrintFormat(req: Request, res: Response) {
  const { id } = req.params;
  const { name, htmlTemplate, isDefault } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.update(printFormats).set({ name, htmlTemplate, isDefault }).where(eq(printFormats.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function deletePrintFormat(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.delete(printFormats).where(eq(printFormats.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

function renderTemplate(template: string, data: any): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    return path.split('.').reduce((obj: any, key: string) => obj?.[key], data) ?? '';
  });
}

export async function previewPrintFormat(req: Request, res: Response) {
  const { id } = req.params;
  const { recordId } = req.body;
  try {
    const html = await req.runInTenant!(async (db) => {
      const [pf] = await db.select().from(printFormats).where(eq(printFormats.id, id)).limit(1);
      if (!pf) throw new Error('Print format not found.');

      // Load record data dynamically
      const tableName = pf.module === 'leave' ? 'leave_requests' : pf.module === 'payroll' ? 'payslips' : pf.module + 's';
      const { rows } = await db.execute(sql`SELECT * FROM ${sql.identifier(req.tenant!.schemaName)}.${sql.identifier(tableName)} WHERE id = ${recordId}::uuid`);
      const record = rows[0] || {};

      // Load employee metadata if applicable
      let employee = {};
      if (record.employee_id || record.employeeId) {
        const empId = record.employee_id || record.employeeId;
        const { rows: emps } = await db.execute(sql`SELECT * FROM ${sql.identifier(req.tenant!.schemaName)}.employees WHERE id = ${empId}::uuid`);
        employee = emps[0] || {};
      }

      // Render Handlebars-like template
      return renderTemplate(pf.htmlTemplate, { [pf.module]: record, employee });
    });

    return res.json({ data: html });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. EMAIL ALERT RULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getEmailAlerts(req: Request, res: Response) {
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(emailAlertRules)
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function createEmailAlert(req: Request, res: Response) {
  const { name, doctype, event, condition, recipients, subjectTemplate, bodyTemplate, isActive } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.insert(emailAlertRules).values({
        name,
        doctype,
        event,
        condition: condition || 'true',
        recipients: recipients || [],
        subjectTemplate,
        bodyTemplate,
        isActive: isActive !== false,
      }).returning()
    );
    return res.status(201).json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function updateEmailAlert(req: Request, res: Response) {
  const { id } = req.params;
  const { name, doctype, event, condition, recipients, subjectTemplate, bodyTemplate, isActive } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.update(emailAlertRules).set({
        name, doctype, event, condition, recipients, subjectTemplate, bodyTemplate, isActive
      }).where(eq(emailAlertRules.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function deleteEmailAlert(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.delete(emailAlertRules).where(eq(emailAlertRules.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function testEmailAlert(req: Request, res: Response) {
  const { id } = req.params;
  const { toEmail } = req.body;
  if (!toEmail) return res.status(400).json({ error: 'toEmail is required' });
  try {
    await req.runInTenant!(async (db) => {
      const [rule] = await db.select().from(emailAlertRules).where(eq(emailAlertRules.id, id)).limit(1);
      if (!rule) throw new Error('Alert rule not found.');

      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: Number(process.env.SMTP_PORT || 587),
        auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
      });

      await transporter.sendMail({
        from: '"CyberlinkHR" <noreply@cyberlinkhr.com>',
        to: toEmail,
        subject: `[TEST] ${rule.subjectTemplate}`,
        text: `This is a test email for alert rule: ${rule.name}\n\nBody template:\n${rule.bodyTemplate}`,
      });
    });
    return res.json({ message: `Test email sent to ${toEmail}` });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. REPORT BUILDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function getReports(req: Request, res: Response) {
  try {
    const data = await req.runInTenant!(async (db) =>
      db.select().from(savedReports)
    );
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function createReport(req: Request, res: Response) {
  const { name, type, doctype, queryOrScript, columns, filters, isStandard } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.insert(savedReports).values({
        name,
        type,
        doctype,
        queryOrScript,
        columns: columns || [],
        filters: filters || [],
        isStandard: !!isStandard,
        createdBy: req.user?.userId,
      }).returning()
    );
    return res.status(201).json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function updateReport(req: Request, res: Response) {
  const { id } = req.params;
  const { name, type, doctype, queryOrScript, columns, filters, isStandard } = req.body;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.update(savedReports).set({
        name, type, doctype, queryOrScript, columns, filters, isStandard
      }).where(eq(savedReports.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

export async function deleteReport(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const [row] = await req.runInTenant!(async (db) =>
      db.delete(savedReports).where(eq(savedReports.id, id)).returning()
    );
    return res.json({ data: row });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

function validateQuery(query: string) {
  const forbidden = ['drop', 'delete', 'update', 'insert', 'truncate', 'alter', 'create', 'grant', 'revoke'];
  const lowercaseQuery = query.toLowerCase();
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowercaseQuery)) {
      throw new Error(`Query contains forbidden keyword: ${word}`);
    }
  }
}

export async function runReport(req: Request, res: Response) {
  const { id } = req.params;
  const { filters = {} } = req.body;
  try {
    const results = await req.runInTenant!(async (db) => {
      const [report] = await db.select().from(savedReports).where(eq(savedReports.id, id)).limit(1);
      if (!report) throw new Error('Report not found.');

      if (report.type === 'QUERY') {
        validateQuery(report.queryOrScript);
        // Safely replace schema placeholders
        const formattedQuery = report.queryOrScript.replace(/\{tenant\}/g, `"${req.tenant!.schemaName}"`);
        
        // Construct query parameters if any filters are defined
        const filterKeys = Object.keys(filters);
        const values = filterKeys.map(k => filters[k]);
        
        // Execute raw safe SELECT
        const res = typeof (db as any).session?.client?.query === 'function'
          ? await (db as any).session.client.query(formattedQuery, values)
          : await db.execute(sql.raw(formattedQuery));
        const rows = (res.rows || res) as any[];
        
        const cols = report.columns || [];
        return { columns: cols, rows, total_rows: rows.length };
      } else {
        // SCRIPT type: execute pre-approved script metadata
        return { columns: [], rows: [], total_rows: 0 };
      }
    });

    return res.json({ data: results });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

export async function exportReport(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const csvContent = await req.runInTenant!(async (db) => {
      const [report] = await db.select().from(savedReports).where(eq(savedReports.id, id)).limit(1);
      if (!report) throw new Error('Report not found.');

      validateQuery(report.queryOrScript);
      const formattedQuery = report.queryOrScript.replace(/\{tenant\}/g, `"${req.tenant!.schemaName}"`);
      const { rows } = await db.execute(formattedQuery);

      if (!rows.length) return '';

      const headers = Object.keys(rows[0]).join(',');
      const fileRows = rows.map((row: any) =>
        Object.keys(row).map(key => {
          const val = row[key];
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? '';
        }).join(',')
      );
      return [headers, ...fileRows].join('\n');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report_export_${id}.csv`);
    return res.send(csvContent);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}
export async function exportReportExcel(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const { ExcelJS } = await import('exceljs').catch(() => ({ ExcelJS: null })) as any;
    if (!ExcelJS) {
      // Fall back to CSV if exceljs not available
      return exportReport(req, res);
    }
    const workbookData = await req.runInTenant!(async (db) => {
      const [report] = await db.select().from(savedReports).where(eq(savedReports.id, id)).limit(1);
      if (!report) throw new Error('Report not found.');

      validateQuery(report.queryOrScript);
      const formattedQuery = report.queryOrScript.replace(/\{tenant\}/g, `"${req.tenant!.schemaName}"`);
      const { rows } = await db.execute(formattedQuery);
      return { name: report.name, rows };
    });

    const ExcelJSModule = await import('exceljs');
    const workbook = new ExcelJSModule.default.Workbook();
    const sheet = workbook.addWorksheet(workbookData.name);

    if (workbookData.rows.length > 0) {
      const headers = Object.keys(workbookData.rows[0]);
      sheet.addRow(headers);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      workbookData.rows.forEach((row: any) => {
        sheet.addRow(Object.values(row));
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${id}.xlsx`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}
