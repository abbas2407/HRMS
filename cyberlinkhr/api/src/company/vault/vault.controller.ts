import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { eq, and, desc, sql } from 'drizzle-orm';
import { vaultFolders, vaultDocuments, employees, users, departments } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || 'local-upload-secret-changeme';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const schema = req.tenant?.schemaName || 'unknown';
    const folderId = String(req.params.folderId || 'vault');
    const dir = path.join(UPLOADS_DIR, 'vault', schema, folderId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF, JPG, PNG, Word, Excel allowed'));
};

export const vaultUpload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

function signDownloadUrl(docId: string): string {
  const expires = Date.now() + 3_600_000;
  const sig = crypto.createHmac('sha256', UPLOAD_SECRET).update(`vault:${docId}:${expires}`).digest('hex');
  return `/api/vault/download/${docId}?expires=${expires}&sig=${sig}`;
}

function verifyDownloadSig(docId: string, expires: string, sig: string): boolean {
  const expected = crypto.createHmac('sha256', UPLOAD_SECRET).update(`vault:${docId}:${expires}`).digest('hex');
  return sig === expected && Date.now() < Number(expires);
}

function canAccessFolder(folder: any, user: any): boolean {
  if (user.role === 'HR_ADMIN') return true;
  if (folder.targetType === 'ALL') return true;
  if (folder.targetType === 'ROLE' && folder.targetRole === user.role) return true;
  // Department check handled via employee lookup at list time
  return false;
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function listFolders(req: Request, res: Response) {
  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  let employeeDeptId: string | null = null;
  if (!isAdmin && empId) {
    const [emp] = await req.runInTenant!(async (db) =>
      db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, empId))
    );
    employeeDeptId = emp?.departmentId ?? null;
  }

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: vaultFolders.id,
      name: vaultFolders.name,
      description: vaultFolders.description,
      icon: vaultFolders.icon,
      targetType: vaultFolders.targetType,
      targetRole: vaultFolders.targetRole,
      departmentId: vaultFolders.departmentId,
      isArchived: vaultFolders.isArchived,
      createdAt: vaultFolders.createdAt,
      docCount: sql<number>`(SELECT COUNT(*) FROM "${sql.raw(req.tenant!.schemaName)}".vault_documents vd WHERE vd.folder_id = ${vaultFolders.id} AND vd.is_deleted = FALSE)`,
    }).from(vaultFolders)
      .where(eq(vaultFolders.isArchived, false))
      .orderBy(vaultFolders.name)
  );

  const filtered = isAdmin ? rows : rows.filter(f => {
    if (f.targetType === 'ALL') return true;
    if (f.targetType === 'ROLE' && f.targetRole === req.user?.role) return true;
    if (f.targetType === 'DEPARTMENT' && f.departmentId === employeeDeptId) return true;
    return false;
  });

  return res.json({ data: filtered });
}

export async function createFolder(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    icon: z.string().max(10).optional(),
    targetType: z.enum(['ALL', 'DEPARTMENT', 'ROLE']).default('ALL'),
    departmentId: z.string().uuid().optional(),
    targetRole: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(vaultFolders).values({
      name: parsed.data.name,
      description: parsed.data.description,
      icon: parsed.data.icon || '📁',
      targetType: parsed.data.targetType,
      departmentId: parsed.data.departmentId,
      targetRole: parsed.data.targetRole,
      createdBy: req.user!.userId,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateFolder(req: Request, res: Response) {
  const id = String(req.params.id);
  const { name, description, icon, targetType, departmentId, targetRole, isArchived } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (icon !== undefined) updates.icon = icon;
  if (targetType) updates.targetType = targetType;
  if (departmentId !== undefined) updates.departmentId = departmentId || null;
  if (targetRole !== undefined) updates.targetRole = targetRole || null;
  if (isArchived !== undefined) updates.isArchived = isArchived;

  const [row] = await req.runInTenant!(async (db) =>
    db.update(vaultFolders).set(updates).where(eq(vaultFolders.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: row });
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function listDocuments(req: Request, res: Response) {
  const folderId = String(req.params.folderId);

  const docs = await req.runInTenant!(async (db) =>
    db.select({
      id: vaultDocuments.id,
      folderId: vaultDocuments.folderId,
      title: vaultDocuments.title,
      description: vaultDocuments.description,
      fileName: vaultDocuments.fileName,
      fileSize: vaultDocuments.fileSize,
      fileType: vaultDocuments.fileType,
      version: vaultDocuments.version,
      createdAt: vaultDocuments.createdAt,
      uploaderEmail: users.email,
    })
      .from(vaultDocuments)
      .leftJoin(users, eq(vaultDocuments.uploadedBy, users.id))
      .where(and(eq(vaultDocuments.folderId, folderId), eq(vaultDocuments.isDeleted, false)))
      .orderBy(desc(vaultDocuments.createdAt))
  );

  const withUrls = docs.map(d => ({ ...d, downloadUrl: signDownloadUrl(d.id) }));
  return res.json({ data: withUrls });
}

export async function uploadDocument(req: Request, res: Response) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const { title, description } = req.body;
  if (!title?.trim()) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Title required' });
  }

  const folderId = String(req.params.folderId);
  const [folder] = await req.runInTenant!(async (db) =>
    db.select({ id: vaultFolders.id }).from(vaultFolders).where(eq(vaultFolders.id, folderId))
  );
  if (!folder) { fs.unlinkSync(file.path); return res.status(404).json({ error: 'Folder not found' }); }

  const relativePath = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, '/');

  // Determine version: count existing docs with same title in folder
  const [existing] = await req.runInTenant!(async (db) =>
    db.select({ count: sql<number>`COUNT(*)` })
      .from(vaultDocuments)
      .where(and(eq(vaultDocuments.folderId, folderId), eq(vaultDocuments.title, title.trim())))
  );
  const version = Number(existing?.count ?? 0) + 1;

  const [doc] = await req.runInTenant!(async (db) =>
    db.insert(vaultDocuments).values({
      folderId,
      title: title.trim(),
      description: description?.trim() || null,
      fileName: file.originalname,
      fileUrl: relativePath,
      fileSize: file.size,
      fileType: file.mimetype,
      version,
      uploadedBy: req.user!.userId,
    }).returning()
  );

  return res.status(201).json({ data: { ...doc, downloadUrl: signDownloadUrl(doc.id) } });
}

export async function deleteDocument(req: Request, res: Response) {
  const id = String(req.params.id);
  const [doc] = await req.runInTenant!(async (db) =>
    db.update(vaultDocuments).set({ isDeleted: true }).where(eq(vaultDocuments.id, id)).returning()
  );
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json({ data: { message: 'Deleted' } });
}

export async function downloadVaultDocument(req: Request, res: Response) {
  const { expires, sig } = req.query as Record<string, string>;
  const id = String(req.params.id);

  if (!verifyDownloadSig(id, expires, sig)) {
    return res.status(403).json({ error: 'Invalid or expired download link' });
  }

  const [doc] = await req.runInTenant!(async (db) =>
    db.select().from(vaultDocuments).where(and(eq(vaultDocuments.id, id), eq(vaultDocuments.isDeleted, false))).limit(1)
  );
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, doc.fileUrl);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
  res.sendFile(filePath);
}
