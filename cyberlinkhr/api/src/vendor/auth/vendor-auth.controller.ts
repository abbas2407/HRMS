import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../shared/db/connection';
import { vendorUsers } from '../../shared/db/public.schema';
import { signVendorToken } from '../../shared/utils/jwt';
import { blacklistToken } from '../../shared/utils/redis';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function vendorLogin(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const [user] = await db.select().from(vendorUsers).where(eq(vendorUsers.email, email)).limit(1);

  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  await db.update(vendorUsers).set({ lastLogin: new Date() }).where(eq(vendorUsers.id, user.id));

  const token = signVendorToken({ vendorUserId: user.id, email: user.email, type: 'vendor' });
  return res.json({ data: { token, user: { id: user.id, name: user.name, email: user.email } } });
}

export async function vendorLogout(req: Request, res: Response) {
  const token = req.headers.authorization!.slice(7);
  // Vendor tokens live 8h; blacklist with same TTL
  await blacklistToken(`vendor:${token}`, 8 * 60 * 60);
  return res.json({ data: { message: 'Logged out' } });
}

export async function vendorRefresh(req: Request, res: Response) {
  return res.status(501).json({ error: 'Not implemented yet' });
}
