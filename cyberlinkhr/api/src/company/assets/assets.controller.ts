import { Request, Response } from 'express';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { assets, assetAssignments, employees } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['LAPTOP', 'PHONE', 'HEADSET', 'VEHICLE', 'FURNITURE', 'MONITOR', 'OTHER']),
  brand: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.string().optional(),
  purchaseValue: z.number().optional(),
  notes: z.string().optional(),
});

async function nextAssetCode(runInTenant: Request['runInTenant']): Promise<string> {
  const [r] = await runInTenant!(async (db) =>
    db.select({ c: sql<number>`count(*)` }).from(assets)
  );
  return `ASSET-${String(Number(r?.c || 0) + 1).padStart(3, '0')}`;
}

export async function listAssets(req: Request, res: Response) {
  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: assets.id,
      name: assets.name,
      assetCode: assets.assetCode,
      category: assets.category,
      brand: assets.brand,
      serialNumber: assets.serialNumber,
      status: assets.status,
      purchaseDate: assets.purchaseDate,
      purchaseValue: assets.purchaseValue,
      notes: assets.notes,
      assignedToId: assetAssignments.employeeId,
      assignedToName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      assignedAt: assetAssignments.assignedAt,
    })
      .from(assets)
      .leftJoin(
        assetAssignments,
        and(eq(assetAssignments.assetId, assets.id), isNull(assetAssignments.returnedAt))
      )
      .leftJoin(employees, eq(assetAssignments.employeeId, employees.id))
      .orderBy(desc(assets.createdAt))
  );
  return res.json({ data: rows });
}

export async function createAsset(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const assetCode = await nextAssetCode(req.runInTenant);

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(assets).values({
      name: d.name,
      assetCode,
      category: d.category,
      brand: d.brand,
      serialNumber: d.serialNumber,
      purchaseDate: d.purchaseDate,
      purchaseValue: d.purchaseValue ? String(d.purchaseValue) : undefined,
      notes: d.notes,
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateAsset(req: Request, res: Response) {
  const { id } = req.params;
  const { name, brand, serialNumber, purchaseDate, purchaseValue, notes } = req.body;
  const [row] = await req.runInTenant!(async (db) =>
    db.update(assets).set({
      name: name || undefined,
      brand: brand || undefined,
      serialNumber: serialNumber || undefined,
      purchaseDate: purchaseDate || undefined,
      purchaseValue: purchaseValue ? String(purchaseValue) : undefined,
      notes: notes || undefined,
      updatedAt: new Date(),
    }).where(eq(assets.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function assignAsset(req: Request, res: Response) {
  const { id } = req.params;
  const { employeeId, assignedAt, remarks } = req.body;
  if (!employeeId) return res.status(400).json({ error: 'employeeId required' });

  const [asset] = await req.runInTenant!(async (db) =>
    db.select({ status: assets.status }).from(assets).where(eq(assets.id, id))
  );
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (asset.status !== 'AVAILABLE') return res.status(400).json({ error: 'Asset is not available for assignment' });

  await req.runInTenant!(async (db) => {
    await db.insert(assetAssignments).values({
      assetId: id,
      employeeId,
      assignedAt: assignedAt || new Date().toISOString().split('T')[0],
      remarks,
      assignedBy: req.user!.userId,
    });
    await db.update(assets).set({ status: 'ASSIGNED', updatedAt: new Date() }).where(eq(assets.id, id));
  });

  return res.json({ success: true });
}

export async function returnAsset(req: Request, res: Response) {
  const { id } = req.params;
  const { returnedAt, condition, remarks } = req.body;

  const [current] = await req.runInTenant!(async (db) =>
    db.select({ id: assetAssignments.id })
      .from(assetAssignments)
      .where(and(eq(assetAssignments.assetId, id), isNull(assetAssignments.returnedAt)))
      .orderBy(desc(assetAssignments.createdAt)).limit(1)
  );
  if (!current) return res.status(400).json({ error: 'No active assignment found' });

  await req.runInTenant!(async (db) => {
    await db.update(assetAssignments).set({
      returnedAt: returnedAt || new Date().toISOString().split('T')[0],
      condition: condition || 'GOOD',
      remarks,
    }).where(eq(assetAssignments.id, current.id));
    await db.update(assets).set({ status: 'AVAILABLE', updatedAt: new Date() }).where(eq(assets.id, id));
  });

  return res.json({ success: true });
}

export async function getEmployeeAssets(req: Request, res: Response) {
  const { employeeId } = req.params;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      assignmentId: assetAssignments.id,
      assetId: assets.id,
      assetCode: assets.assetCode,
      name: assets.name,
      category: assets.category,
      brand: assets.brand,
      serialNumber: assets.serialNumber,
      assignedAt: assetAssignments.assignedAt,
      returnedAt: assetAssignments.returnedAt,
      condition: assetAssignments.condition,
      remarks: assetAssignments.remarks,
    })
      .from(assetAssignments)
      .innerJoin(assets, eq(assetAssignments.assetId, assets.id))
      .where(eq(assetAssignments.employeeId, employeeId))
      .orderBy(desc(assetAssignments.assignedAt))
  );

  return res.json({ data: rows });
}
