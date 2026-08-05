import {
  pgTable,
  pgSchema,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'TRIAL',
  'ACTIVE',
  'EXPIRED',
  'TRIAL_EXPIRED',
  'SUSPENDED',
  'CANCELLED',
]);

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }).notNull(),
  maxEmployees: integer('max_employees'),
  features: text('features').default('[]'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const vendorUsers = pgTable('vendor_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  schemaName: varchar('schema_name', { length: 100 }).notNull().unique(),
  planId: uuid('plan_id').references(() => plans.id),
  status: tenantStatusEnum('status').default('TRIAL').notNull(),
  trialStartsAt: timestamp('trial_starts_at'),
  trialEndsAt: timestamp('trial_ends_at'),
  subscriptionStartsAt: timestamp('subscription_starts_at'),
  subscriptionEndsAt: timestamp('subscription_ends_at'),
  employeeCount: integer('employee_count').default(0),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }),
  pfNumber: varchar('pf_number', { length: 30 }),
  esicNumber: varchar('esic_number', { length: 30 }),
  ptState: varchar('pt_state', { length: 50 }),
  adminEmail: varchar('admin_email', { length: 255 }),
  features: text('features').default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => vendorUsers.id),
});

export const billingRecords = pgTable('billing_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  method: varchar('method', { length: 50 }).default('BANK_TRANSFER'),
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => vendorUsers.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const vendorAuditLog = pgTable('vendor_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorUserId: uuid('vendor_user_id').references(() => vendorUsers.id),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  targetAll: boolean('target_all').default(true),
  targetTenantIds: text('target_tenant_ids').default('[]'),
  sentBy: uuid('sent_by').references(() => vendorUsers.id),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});
