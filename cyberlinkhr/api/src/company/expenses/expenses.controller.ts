import { Request, Response } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { expenseClaims, expenseItems, employees } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const itemSchema = z.object({
  category: z.enum(['TRAVEL', 'FOOD', 'ACCOMMODATION', 'COMMUNICATION', 'OFFICE_SUPPLIES', 'MEDICAL', 'OTHER']),
  description: z.string().min(1).max(300),
  amount: z.number().positive(),
  expenseDate: z.string(),
});

const claimSchema = z.object({
  title: z.string().min(1).max(200),
  items: z.array(itemSchema).min(1),
});

export async function listClaims(req: Request, res: Response) {
  const isAdmin = req.user?.role === 'HR_ADMIN' || req.user?.role === 'MANAGER';
  const empId = req.user?.employeeId;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: expenseClaims.id,
      title: expenseClaims.title,
      totalAmount: expenseClaims.totalAmount,
      status: expenseClaims.status,
      submittedAt: expenseClaims.submittedAt,
      reviewedAt: expenseClaims.reviewedAt,
      remarks: expenseClaims.remarks,
      reimbursedAt: expenseClaims.reimbursedAt,
      employeeId: expenseClaims.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeCode: employees.employeeCode,
      createdAt: expenseClaims.createdAt,
    })
      .from(expenseClaims)
      .innerJoin(employees, eq(expenseClaims.employeeId, employees.id))
      .where(isAdmin ? sql`1=1` : eq(expenseClaims.employeeId, empId!))
      .orderBy(desc(expenseClaims.createdAt))
  );
  return res.json({ data: rows });
}

export async function getClaim(req: Request, res: Response) {
  const { id } = req.params;
  const isAdmin = req.user?.role === 'HR_ADMIN' || req.user?.role === 'MANAGER';
  const empId = req.user?.employeeId;

  const [claim] = await req.runInTenant!(async (db) =>
    db.select({
      id: expenseClaims.id,
      title: expenseClaims.title,
      totalAmount: expenseClaims.totalAmount,
      status: expenseClaims.status,
      submittedAt: expenseClaims.submittedAt,
      reviewedAt: expenseClaims.reviewedAt,
      remarks: expenseClaims.remarks,
      reimbursedAt: expenseClaims.reimbursedAt,
      employeeId: expenseClaims.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
    })
      .from(expenseClaims)
      .innerJoin(employees, eq(expenseClaims.employeeId, employees.id))
      .where(eq(expenseClaims.id, id))
  );
  if (!claim) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && claim.employeeId !== empId) return res.status(403).json({ error: 'Forbidden' });

  const items = await req.runInTenant!(async (db) =>
    db.select().from(expenseItems).where(eq(expenseItems.claimId, id)).orderBy(expenseItems.expenseDate)
  );
  return res.json({ data: { ...claim, items } });
}

export async function createClaim(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile' });

  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { title, items } = parsed.data;
  const total = items.reduce((s, i) => s + i.amount, 0);

  const [claim] = await req.runInTenant!(async (db) =>
    db.insert(expenseClaims).values({
      employeeId: empId,
      title,
      totalAmount: String(total),
    }).returning()
  );

  await req.runInTenant!(async (db) =>
    db.insert(expenseItems).values(
      items.map(i => ({
        claimId: claim.id,
        category: i.category,
        description: i.description,
        amount: String(i.amount),
        expenseDate: i.expenseDate,
      }))
    )
  );

  return res.status(201).json({ data: claim });
}

export async function submitClaim(req: Request, res: Response) {
  const { id } = req.params;
  const empId = req.user?.employeeId;

  const [claim] = await req.runInTenant!(async (db) =>
    db.select({ employeeId: expenseClaims.employeeId, status: expenseClaims.status })
      .from(expenseClaims).where(eq(expenseClaims.id, id))
  );
  if (!claim) return res.status(404).json({ error: 'Not found' });
  if (claim.employeeId !== empId) return res.status(403).json({ error: 'Forbidden' });
  if (claim.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT claims can be submitted' });

  const [row] = await req.runInTenant!(async (db) =>
    db.update(expenseClaims).set({
      status: 'SUBMITTED',
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(expenseClaims.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function reviewClaim(req: Request, res: Response) {
  const { id } = req.params;
  const { action, remarks } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'action must be APPROVED or REJECTED' });
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.update(expenseClaims).set({
      status: action,
      remarks,
      reviewedBy: req.user!.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(expenseClaims.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function reimburseClaim(req: Request, res: Response) {
  const { id } = req.params;
  const [row] = await req.runInTenant!(async (db) =>
    db.update(expenseClaims).set({
      status: 'REIMBURSED',
      reimbursedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(expenseClaims.id, id), eq(expenseClaims.status, 'APPROVED'))).returning()
  );
  if (!row) return res.status(400).json({ error: 'Claim must be APPROVED before reimbursement' });
  return res.json({ data: row });
}
