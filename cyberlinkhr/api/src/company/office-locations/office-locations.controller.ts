import { Request, Response } from 'express';
import { officeLocations } from '../../shared/db/tenant.schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000).default(100),
  isActive: z.boolean().default(true),
});

export async function listLocations(req: Request, res: Response) {
  const data = await req.runInTenant!(async (db) =>
    db.select().from(officeLocations).orderBy(officeLocations.name)
  );
  return res.json({ data });
}

export async function createLocation(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(officeLocations).values({
      ...parsed.data,
      lat: String(parsed.data.lat),
      lng: String(parsed.data.lng),
    }).returning()
  );
  return res.status(201).json({ data: row });
}

export async function updateLocation(req: Request, res: Response) {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const id = String(req.params.id);

  const update: any = { ...parsed.data };
  if (parsed.data.lat !== undefined) update.lat = String(parsed.data.lat);
  if (parsed.data.lng !== undefined) update.lng = String(parsed.data.lng);

  const [row] = await req.runInTenant!(async (db) =>
    db.update(officeLocations).set(update).where(eq(officeLocations.id, id)).returning()
  );
  if (!row) return res.status(404).json({ error: 'Location not found' });
  return res.json({ data: row });
}

export async function deleteLocation(req: Request, res: Response) {
  const id = String(req.params.id);
  await req.runInTenant!(async (db) =>
    db.delete(officeLocations).where(eq(officeLocations.id, id))
  );
  return res.json({ data: { message: 'Deleted' } });
}
