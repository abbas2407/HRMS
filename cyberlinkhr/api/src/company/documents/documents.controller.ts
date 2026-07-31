import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { documents, employeeAuditLog, employeeSalary, shiftAssignments } from '../../shared/db/tenant.schema';
import { eq, and, desc } from 'drizzle-orm';

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || 'local-upload-secret-changeme';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export const DOC_TYPES = [
  'AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID',
  'OFFER_LETTER', 'APPOINTMENT_LETTER', 'SALARY_REVISION_LETTER',
  'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'EDUCATIONAL_CERTIFICATE', 'OTHER',
] as const;

export const REQUIRED_DOCS = ['AADHAAR', 'PAN', 'OFFER_LETTER', 'APPOINTMENT_LETTER'];
export const EXPIRY_DOCS = ['PASSPORT', 'DRIVING_LICENCE'];

// Multer disk storage — runs AFTER authenticate + resolveTenant
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const schema = req.tenant?.schemaName || 'unknown';
    const empId = String(req.params.empId);
    const dir = path.join(UPLOADS_DIR, schema, empId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF, JPG, PNG allowed'));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Generate 1-hour signed download URL
export function signDownloadUrl(docId: string): string {
  const expires = Date.now() + 3_600_000;
  const sig = crypto.createHmac('sha256', UPLOAD_SECRET).update(`${docId}:${expires}`).digest('hex');
  return `/api/documents/${docId}/download?expires=${expires}&sig=${sig}`;
}

function verifyDownloadSig(docId: string, expires: string, sig: string): boolean {
  const expected = crypto.createHmac('sha256', UPLOAD_SECRET).update(`${docId}:${expires}`).digest('hex');
  return sig === expected && Date.now() < Number(expires);
}

// POST /documents/:empId
export async function uploadDocument(req: Request, res: Response) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const { docType, expiryDate, notes } = req.body;
  if (!DOC_TYPES.includes(docType)) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Invalid document type' });
  }

  const empId = String(req.params.empId);
  const relativePath = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, '/');

  const [doc] = await req.runInTenant!(async (db) =>
    db.insert(documents).values({
      employeeId: empId,
      docType,
      fileUrl: relativePath,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedBy: req.user!.userId,
      expiryDate: expiryDate || null,
      notes: notes || null,
    }).returning()
  );

  // Audit log
  await req.runInTenant!(async (db) =>
    db.insert(employeeAuditLog).values({
      employeeId: empId,
      changeType: 'DOCUMENT_UPLOAD',
      fieldName: 'doc_type',
      newValue: docType,
      changedBy: req.user!.userId,
    })
  );

  return res.status(201).json({ data: { ...doc, downloadUrl: signDownloadUrl(doc.id) } });
}

// GET /documents?employeeId=xxx
export async function listDocuments(req: Request, res: Response) {
  const empId = String(req.query.employeeId);
  if (!empId) return res.status(400).json({ error: 'employeeId required' });

  const docs = await req.runInTenant!(async (db) =>
    db.select().from(documents)
      .where(and(eq(documents.employeeId, empId), eq(documents.isDeleted, false)))
      .orderBy(desc(documents.createdAt))
  );

  const withUrls = docs.map(d => ({ ...d, downloadUrl: signDownloadUrl(d.id) }));
  return res.json({ data: withUrls });
}

// DELETE /documents/:id
export async function deleteDocument(req: Request, res: Response) {
  const id = String(req.params.id);

  const [doc] = await req.runInTenant!(async (db) =>
    db.update(documents).set({ isDeleted: true }).where(eq(documents.id, id)).returning()
  );

  if (!doc) return res.status(404).json({ error: 'Document not found' });
  return res.json({ data: { message: 'Document deleted' } });
}

// GET /documents/:id/download?expires=...&sig=...
export async function downloadDocument(req: Request, res: Response) {
  const { expires, sig } = req.query as Record<string, string>;
  const id = String(req.params.id);

  if (!verifyDownloadSig(id, expires, sig)) {
    return res.status(403).json({ error: 'Invalid or expired download link' });
  }

  const [doc] = await req.runInTenant!(async (db) =>
    db.select().from(documents).where(and(eq(documents.id, id), eq(documents.isDeleted, false))).limit(1)
  );

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const filePath = path.join(UPLOADS_DIR, doc.fileUrl);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName || 'document'}"`);
  res.sendFile(filePath);
}

// GET /documents/checklist/:empId
export async function getDocChecklist(req: Request, res: Response) {
  const empId = String(req.params.empId);

  const docs = await req.runInTenant!(async (db) =>
    db.select({ docType: documents.docType, expiryDate: documents.expiryDate, createdAt: documents.createdAt })
      .from(documents)
      .where(and(eq(documents.employeeId, empId), eq(documents.isDeleted, false)))
  );

  const uploaded = new Set(docs.map(d => d.docType));
  const checklist = REQUIRED_DOCS.map(type => ({
    type,
    uploaded: uploaded.has(type),
    uploadedAt: docs.find(d => d.docType === type)?.createdAt ?? null,
  }));

  const completePct = Math.round((checklist.filter(c => c.uploaded).length / checklist.length) * 100);

  // Expiry alerts
  const now = Date.now();
  const in30Days = now + 30 * 86_400_000;
  const expiryAlerts = docs
    .filter(d => d.expiryDate && new Date(d.expiryDate).getTime() <= in30Days)
    .map(d => ({ type: d.docType, expiryDate: d.expiryDate, expired: new Date(d.expiryDate!).getTime() < now }));

  return res.json({ data: { checklist, completePct, expiryAlerts } });
}

// GET /employees/:id/timeline (mounted on employees router)
export async function getEmployeeTimeline(req: Request, res: Response) {
  const empId = String(req.params.id);

  const [auditLogs, salaryRows, docRows] = await req.runInTenant!(async (db) =>
    Promise.all([
      db.select().from(employeeAuditLog).where(eq(employeeAuditLog.employeeId, empId)).orderBy(desc(employeeAuditLog.changedAt)),
      db.select().from(employeeSalary).where(eq(employeeSalary.employeeId, empId)).orderBy(desc(employeeSalary.createdAt)),
      db.select().from(documents).where(and(eq(documents.employeeId, empId), eq(documents.isDeleted, false))).orderBy(desc(documents.createdAt)),
    ])
  );

  const events: any[] = [
    ...auditLogs.map(r => ({
      id: r.id,
      type: 'EMPLOYMENT',
      subType: r.changeType,
      date: r.changedAt,
      title: r.changeType.replace(/_/g, ' '),
      description: r.fieldName
        ? `${r.fieldName}: ${r.oldValue ? `${r.oldValue} → ` : ''}${r.newValue || ''}`
        : r.newValue || '',
    })),
    ...salaryRows.map(r => ({
      id: r.id,
      type: 'SALARY',
      subType: 'SALARY_CHANGE',
      date: r.createdAt,
      title: 'Salary Updated',
      description: `₹${Number(r.gross).toLocaleString('en-IN')}/month effective ${new Date(r.effectiveFrom).toLocaleDateString('en-IN')}`,
      meta: { gross: r.gross, effectiveFrom: r.effectiveFrom, reason: r.reason },
    })),
    ...docRows.map(r => ({
      id: r.id,
      type: 'DOCUMENT',
      subType: r.docType,
      date: r.createdAt,
      title: 'Document Uploaded',
      description: r.docType.replace(/_/g, ' ') + (r.fileName ? ` — ${r.fileName}` : ''),
    })),
  ];

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return res.json({ data: events });
}
