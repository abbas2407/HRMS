import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../shared/db/connection';
import { tenants, plans, billingRecords, vendorAuditLog } from '../../shared/db/public.schema';
import { createTenantSchema } from '../../shared/db/schema-manager';
import { runInTenantSchema } from '../../shared/db/tenant-db';
import { users } from '../../shared/db/tenant.schema';
import { signImpersonateToken } from '../../shared/utils/jwt';
import { eq, and, lt, lte, gte, sql, desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

function log(vendorUserId: string, action: string, targetType: string, targetId: string, ip: string, details?: string) {
  return db.insert(vendorAuditLog).values({ vendorUserId, action, targetType, targetId, details, ipAddress: ip });
}

// GET /vendor/dashboard
export async function getDashboard(req: Request, res: Response) {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 864e5);
  const in14 = new Date(now.getTime() + 14 * 864e5);
  const in30 = new Date(now.getTime() + 30 * 864e5);

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(tenants);
  const [active] = await db.select({ count: sql<number>`count(*)` }).from(tenants).where(eq(tenants.status, 'ACTIVE'));
  const [trial] = await db.select({ count: sql<number>`count(*)` }).from(tenants).where(eq(tenants.status, 'TRIAL'));
  const [expiring7] = await db.select({ count: sql<number>`count(*)` }).from(tenants)
    .where(and(lte(tenants.subscriptionEndsAt, in7), gte(tenants.subscriptionEndsAt, now), eq(tenants.status, 'ACTIVE')));
  const [expiring14] = await db.select({ count: sql<number>`count(*)` }).from(tenants)
    .where(and(lte(tenants.subscriptionEndsAt, in14), gte(tenants.subscriptionEndsAt, now), eq(tenants.status, 'ACTIVE')));
  const [expiring30] = await db.select({ count: sql<number>`count(*)` }).from(tenants)
    .where(and(lte(tenants.subscriptionEndsAt, in30), gte(tenants.subscriptionEndsAt, now), eq(tenants.status, 'ACTIVE')));

  const mrrResult = await db
    .select({ mrr: sql<number>`COALESCE(SUM(${plans.priceMonthly}), 0)` })
    .from(tenants)
    .leftJoin(plans, eq(tenants.planId, plans.id))
    .where(eq(tenants.status, 'ACTIVE'));

  const recentTenants = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, status: tenants.status, createdAt: tenants.createdAt })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(5);

  const expiringList = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, subscriptionEndsAt: tenants.subscriptionEndsAt })
    .from(tenants)
    .where(and(lte(tenants.subscriptionEndsAt, in14), gte(tenants.subscriptionEndsAt, now), eq(tenants.status, 'ACTIVE')))
    .orderBy(tenants.subscriptionEndsAt)
    .limit(10);

  return res.json({
    data: {
      total: Number(total.count),
      active: Number(active.count),
      trial: Number(trial.count),
      expiring7: Number(expiring7.count),
      expiring14: Number(expiring14.count),
      expiring30: Number(expiring30.count),
      mrr: Number(mrrResult[0]?.mrr || 0),
      recentTenants,
      expiringList,
    }
  });
}

// GET /vendor/tenants
export async function listTenants(req: Request, res: Response) {
  const { page = '1', limit = '20', status, search } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const conditions = [];
  if (status) conditions.push(eq(tenants.status, status as any));
  if (search) conditions.push(or(ilike(tenants.name, `%${search}%`), ilike(tenants.slug, `%${search}%`)));

  const query = db
    .select({
      id: tenants.id, name: tenants.name, slug: tenants.slug,
      status: tenants.status, employeeCount: tenants.employeeCount,
      trialEndsAt: tenants.trialEndsAt, subscriptionEndsAt: tenants.subscriptionEndsAt,
      createdAt: tenants.createdAt, adminEmail: tenants.adminEmail,
      planName: plans.name, planPrice: plans.priceMonthly,
    })
    .from(tenants)
    .leftJoin(plans, eq(tenants.planId, plans.id));

  if (conditions.length) query.where(and(...conditions) as any);

  const rows = await query.orderBy(desc(tenants.createdAt)).limit(Number(limit)).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tenants);

  return res.json({ data: rows, meta: { total: Number(count), page: Number(page), limit: Number(limit) } });
}

// POST /vendor/tenants
export async function createTenant(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
    adminEmail: z.string().email(),
    planId: z.string().uuid(),
    trialDays: z.number().default(14),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const { name, slug, adminEmail, planId, trialDays } = parsed.data;
  const vendorUserId = req.vendorUser!.vendorUserId;

  const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (existing) return res.status(409).json({ error: 'Slug already taken' });

  const schemaName = `tenant_${slug.replace(/-/g, '_')}`;
  const trialEndsAt = new Date(Date.now() + trialDays * 864e5);

  const [tenant] = await db.insert(tenants).values({
    name, slug, schemaName, planId, status: 'TRIAL',
    trialStartsAt: new Date(), trialEndsAt,
    adminEmail, createdBy: vendorUserId,
  }).returning();

  await createTenantSchema(schemaName);

  const hash = await bcrypt.hash('Welcome@123', 12);
  await runInTenantSchema(schemaName, async (tdb) => {
    await tdb.insert(users).values({ email: adminEmail, passwordHash: hash, role: 'HR_ADMIN' });
  });

  await log(vendorUserId, 'TENANT_CREATED', 'tenant', tenant.id, req.ip || '', `Created ${name}`);

  return res.status(201).json({
    data: tenant,
    meta: { message: `Company created. HR Admin login: ${adminEmail} / Welcome@123` }
  });
}

// GET /vendor/tenants/:id
export async function getTenant(req: Request, res: Response) {
  const [tenant] = await db
    .select({
      id: tenants.id, name: tenants.name, slug: tenants.slug, schemaName: tenants.schemaName,
      status: tenants.status, employeeCount: tenants.employeeCount,
      trialStartsAt: tenants.trialStartsAt, trialEndsAt: tenants.trialEndsAt,
      subscriptionStartsAt: tenants.subscriptionStartsAt, subscriptionEndsAt: tenants.subscriptionEndsAt,
      adminEmail: tenants.adminEmail, pfNumber: tenants.pfNumber, esicNumber: tenants.esicNumber,
      ptState: tenants.ptState, createdAt: tenants.createdAt,
      planId: tenants.planId, planName: plans.name, planPrice: plans.priceMonthly,
    })
    .from(tenants)
    .leftJoin(plans, eq(tenants.planId, plans.id))
    .where(eq(tenants.id, String(req.params.id)))
    .limit(1);

  if (!tenant) return res.status(404).json({ error: 'Company not found' });

  const billing = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.tenantId, tenant.id))
    .orderBy(desc(billingRecords.createdAt))
    .limit(10);

  return res.json({ data: { ...tenant, billing } });
}

// PUT /vendor/tenants/:id/status
export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body;
  const allowed = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const tid1 = String(req.params.id);
  await db.update(tenants).set({ status }).where(eq(tenants.id, tid1));
  await log(req.vendorUser!.vendorUserId, 'STATUS_CHANGED', 'tenant', tid1, req.ip || '', `→ ${status}`);

  return res.json({ data: { message: `Status updated to ${status}` } });
}

// PUT /vendor/tenants/:id/trial
export async function extendTrial(req: Request, res: Response) {
  const { trialEndsAt } = req.body;
  if (!trialEndsAt) return res.status(400).json({ error: 'trialEndsAt required' });

  const tid2 = String(req.params.id);
  await db.update(tenants).set({ trialEndsAt: new Date(trialEndsAt), status: 'TRIAL' }).where(eq(tenants.id, tid2));
  await log(req.vendorUser!.vendorUserId, 'TRIAL_EXTENDED', 'tenant', tid2, req.ip || '', trialEndsAt);

  return res.json({ data: { message: 'Trial extended' } });
}

// PUT /vendor/tenants/:id/subscription
export async function updateSubscription(req: Request, res: Response) {
  const { subscriptionEndsAt, planId } = req.body;
  if (!subscriptionEndsAt) return res.status(400).json({ error: 'subscriptionEndsAt required' });

  const update: any = {
    subscriptionEndsAt: new Date(subscriptionEndsAt),
    subscriptionStartsAt: new Date(),
    status: 'ACTIVE',
  };
  if (planId) update.planId = planId;

  const tid3 = String(req.params.id);
  await db.update(tenants).set(update).where(eq(tenants.id, tid3));
  await log(req.vendorUser!.vendorUserId, 'SUBSCRIPTION_UPDATED', 'tenant', tid3, req.ip || '', subscriptionEndsAt);

  return res.json({ data: { message: 'Subscription updated' } });
}

// POST /vendor/tenants/:id/impersonate
export async function impersonate(req: Request, res: Response) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, String(req.params.id))).limit(1);
  if (!tenant) return res.status(404).json({ error: 'Company not found' });

  const adminUser = await runInTenantSchema(tenant.schemaName, async (tdb) => {
    const [u] = await tdb.select().from(users).where(eq(users.role, 'HR_ADMIN')).limit(1);
    return u;
  });

  if (!adminUser) return res.status(404).json({ error: 'No HR Admin found for this company' });

  const token = signImpersonateToken({
    userId: adminUser.id,
    role: 'HR_ADMIN',
    tenantId: tenant.id,
    schemaName: tenant.schemaName,
    email: adminUser.email,
  });

  await log(req.vendorUser!.vendorUserId, 'IMPERSONATE', 'tenant', tenant.id, req.ip || '', `Impersonated ${tenant.name}`);

  return res.json({ data: { token, tenant: { slug: tenant.slug, name: tenant.name } } });
}

// GET /vendor/tenants/:id/usage
export async function getUsage(req: Request, res: Response) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, String(req.params.id))).limit(1);
  if (!tenant) return res.status(404).json({ error: 'Not found' });

  const empCount = await runInTenantSchema(tenant.schemaName, async (tdb) => {
    const { employees } = await import('../../shared/db/tenant.schema');
    const [r] = await tdb.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.status, 'ACTIVE'));
    return Number(r.count);
  });

  return res.json({ data: { employeeCount: empCount, storageUsed: 0, payrollRunsThisMonth: 0 } });
}

// POST /vendor/billing
export async function recordPayment(req: Request, res: Response) {
  const schema = z.object({
    tenantId: z.string().uuid(),
    amount: z.number().positive(),
    method: z.string().default('BANK_TRANSFER'),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const [record] = await db.insert(billingRecords).values({
    tenantId: parsed.data.tenantId,
    amount: String(parsed.data.amount),
    method: parsed.data.method,
    notes: parsed.data.notes,
    recordedBy: req.vendorUser!.vendorUserId,
  }).returning();

  await log(req.vendorUser!.vendorUserId, 'PAYMENT_RECORDED', 'tenant', parsed.data.tenantId, req.ip || '', `₹${parsed.data.amount}`);

  return res.status(201).json({ data: record });
}

// GET /vendor/billing
export async function listPayments(req: Request, res: Response) {
  const payments = await db
    .select({
      id: billingRecords.id, amount: billingRecords.amount,
      method: billingRecords.method, notes: billingRecords.notes,
      createdAt: billingRecords.createdAt,
      tenantName: tenants.name, tenantSlug: tenants.slug,
    })
    .from(billingRecords)
    .leftJoin(tenants, eq(billingRecords.tenantId, tenants.id))
    .orderBy(desc(billingRecords.createdAt))
    .limit(50);

  return res.json({ data: payments });
}

// GET /vendor/audit-log
export async function getAuditLog(req: Request, res: Response) {
  const logs = await db
    .select()
    .from(vendorAuditLog)
    .orderBy(desc(vendorAuditLog.createdAt))
    .limit(100);

  return res.json({ data: logs });
}

// GET /vendor/dashboard/stats (plans list for UI)
export async function listPlans(req: Request, res: Response) {
  const allPlans = await db.select().from(plans).where(eq(plans.isActive, true));
  return res.json({ data: allPlans });
}

// PUT /vendor/tenants/:id
export async function updateTenant(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().min(2),
    adminEmail: z.string().email(),
    planId: z.string().uuid(),
    pfNumber: z.string().nullable().optional(),
    esicNumber: z.string().nullable().optional(),
    ptState: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid input' });
  }

  const tenantId = String(req.params.id);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) return res.status(404).json({ error: 'Company not found' });

  const { name, adminEmail, planId, pfNumber, esicNumber, ptState } = parsed.data;

  // Update in public schema (tenants table)
  await db.update(tenants).set({
    name,
    adminEmail,
    planId,
    pfNumber: pfNumber || null,
    esicNumber: esicNumber || null,
    ptState: ptState || null,
  }).where(eq(tenants.id, tenantId));

  // If adminEmail changed, sync it in the tenant's private schema users table
  if (tenant.adminEmail !== adminEmail) {
    try {
      await runInTenantSchema(tenant.schemaName, async (tdb) => {
        await tdb.update(users).set({ email: adminEmail }).where(eq(users.role, 'HR_ADMIN'));
      });
    } catch (err) {
      console.error(`Failed to sync HR Admin email for tenant schema ${tenant.schemaName}:`, err);
    }
  }

  // Log action
  await log(req.vendorUser!.vendorUserId, 'TENANT_UPDATED', 'tenant', tenantId, req.ip || '', `Updated ${name}`);

  return res.json({ data: { message: 'Company updated successfully' } });
}
