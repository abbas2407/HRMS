import { Request, Response } from 'express';
import { employeeDocuments, employees } from '../../shared/db/tenant.schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

const createDocumentSchema = z.object({
  employeeId: z.string().uuid('Valid employee ID required'),
  documentName: z.string().min(1, 'Document name required'),
  category: z.string().min(1, 'Category required'),
  description: z.string().optional(),
  fileUrl: z.string().min(1, 'File required'),
  fileName: z.string().optional(),
  fileSize: z.string().optional(),
  isPublished: z.boolean().default(true),
});

export async function listEmployeeDocuments(req: Request, res: Response) {
  const employeeId = req.query.employeeId as string | undefined;
  const category = req.query.category as string | undefined;

  try {
    const docs = await req.runInTenant!(async (db) => {
      // Safe migration check for employee_documents table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS employee_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
          document_name VARCHAR(200) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          file_url TEXT NOT NULL,
          file_name VARCHAR(255),
          file_size VARCHAR(50),
          is_published BOOLEAN DEFAULT TRUE NOT NULL,
          uploaded_by UUID,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `);

      let query = db.select({
        id: employeeDocuments.id,
        employeeId: employeeDocuments.employeeId,
        documentName: employeeDocuments.documentName,
        category: employeeDocuments.category,
        description: employeeDocuments.description,
        fileUrl: employeeDocuments.fileUrl,
        fileName: employeeDocuments.fileName,
        fileSize: employeeDocuments.fileSize,
        isPublished: employeeDocuments.isPublished,
        createdAt: employeeDocuments.createdAt,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        employeeCode: employees.employeeCode,
      })
      .from(employeeDocuments)
      .leftJoin(employees, eq(employeeDocuments.employeeId, employees.id))
      .orderBy(desc(employeeDocuments.createdAt));

      if (employeeId) {
        return query.where(eq(employeeDocuments.employeeId, employeeId));
      }
      return query;
    });

    return res.json({ success: true, data: docs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch documents' });
  }
}

export async function createEmployeeDocument(req: Request, res: Response) {
  const parsed = createDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const d = parsed.data;

  try {
    const doc = await req.runInTenant!(async (db) => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS employee_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
          document_name VARCHAR(200) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          file_url TEXT NOT NULL,
          file_name VARCHAR(255),
          file_size VARCHAR(50),
          is_published BOOLEAN DEFAULT TRUE NOT NULL,
          uploaded_by UUID,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `);

      const [newDoc] = await db.insert(employeeDocuments).values({
        employeeId: d.employeeId,
        documentName: d.documentName,
        category: d.category,
        description: d.description || null,
        fileUrl: d.fileUrl,
        fileName: d.fileName || 'Uploaded Document',
        fileSize: d.fileSize || '100 KB',
        isPublished: d.isPublished,
        uploadedBy: req.user?.userId || null,
      }).returning();

      return newDoc;
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to upload document' });
  }
}

export async function deleteEmployeeDocument(req: Request, res: Response) {
  const { id } = req.params;

  try {
    await req.runInTenant!(async (db) => {
      await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
    });

    return res.json({ success: true, message: 'Document deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete document' });
  }
}

export async function getEmployeeTimeline(req: Request, res: Response) {
  return res.json({ success: true, data: [] });
}
