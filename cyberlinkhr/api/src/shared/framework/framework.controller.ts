import { Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
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
  users
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
      // Execute raw query to update current_state
      await db.execute(`
        UPDATE "${req.tenant!.schemaName}"."${tableName}"
        SET current_state = '${toState}'
        WHERE id = '${recordId}'
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
