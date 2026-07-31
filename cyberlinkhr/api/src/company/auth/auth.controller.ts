import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../../shared/db/connection';
import { tenants } from '../../shared/db/public.schema';
import { runInTenantSchema } from '../../shared/db/tenant-db';
import { users, refreshTokens } from '../../shared/db/tenant.schema';
import { signAccessToken, signRefreshToken, verifyAccessToken, hashToken } from '../../shared/utils/jwt';
import { blacklistToken } from '../../shared/utils/redis';
import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  slug: z.string().min(1),
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { email, password, slug } = parsed.data;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) {
    return res.status(401).json({ error: 'Company not found' });
  }

  if (['SUSPENDED', 'CANCELLED'].includes(tenant.status)) {
    return res.status(403).json({ error: `Account ${tenant.status.toLowerCase()}` });
  }

  try {
    const result = await runInTenantSchema(tenant.schemaName, async (db) => {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return user;
    });

    if (!result || !result.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, result.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken({
      userId: result.id,
      role: result.role,
      tenantId: tenant.id,
      schemaName: tenant.schemaName,
      email: result.email,
    });

    const rawRefresh = signRefreshToken(result.id);
    const refreshHash = hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await runInTenantSchema(tenant.schemaName, async (db) => {
      await db.insert(refreshTokens).values({
        userId: result.id,
        tokenHash: refreshHash,
        expiresAt,
      });
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, result.id));
    });

    return res.json({
      data: {
        accessToken,
        refreshToken: rawRefresh,
        user: { id: result.id, email: result.email, role: result.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken, slug } = req.body;
  if (!refreshToken || !slug) {
    return res.status(400).json({ error: 'Missing token or slug' });
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return res.status(401).json({ error: 'Invalid' });

  const tokenHash = hashToken(refreshToken);
  const now = new Date();

  try {
    const token = await runInTenantSchema(tenant.schemaName, async (db) => {
      const [t] = await db
        .select()
        .from(refreshTokens)
        .where(and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, now)
        ))
        .limit(1);
      return t;
    });

    if (!token) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const user = await runInTenantSchema(tenant.schemaName, async (db) => {
      const [u] = await db.select().from(users).where(eq(users.id, token.userId)).limit(1);
      return u;
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    const newRefreshRaw = signRefreshToken(user.id);
    const newRefreshHash = hashToken(newRefreshRaw);
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await runInTenantSchema(tenant.schemaName, async (db) => {
      await db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.id, token.id));
      await db.insert(refreshTokens).values({ userId: user.id, tokenHash: newRefreshHash, expiresAt: newExpiry });
    });

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      tenantId: tenant.id,
      schemaName: tenant.schemaName,
      email: user.email,
    });

    return res.json({ data: { accessToken, refreshToken: newRefreshRaw } });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.headers.authorization!.slice(7);
  await blacklistToken(token, 15 * 60);
  return res.json({ data: { message: 'Logged out' } });
}

export async function forgotPassword(req: Request, res: Response) {
  // Phase 8 - implement password reset email
  return res.json({ data: { message: 'If that email exists, a reset link has been sent.' } });
}

export async function resetPassword(req: Request, res: Response) {
  return res.json({ data: { message: 'Password reset - implement in Phase 8' } });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const user = req.user!;

  await runInTenantSchema(user.schemaName, async (db) => {
    const [u] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);
    if (!u) throw new Error('User not found');
    const valid = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!valid) throw new Error('Wrong current password');
    const hash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.userId));
  });

  return res.json({ data: { message: 'Password changed successfully' } });
}
