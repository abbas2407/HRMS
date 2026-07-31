import { Request, Response } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { helpTickets, helpTicketComments, employees, users } from '../../shared/db/tenant.schema';
import { notify, audit } from '../../shared/utils/notify';
import { z } from 'zod';

const CATEGORIES = ['IT', 'FACILITIES', 'HR_QUERY', 'PAYROLL', 'ADMIN', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];

const ticketSchema = z.object({
  category: z.enum(['IT', 'FACILITIES', 'HR_QUERY', 'PAYROLL', 'ADMIN', 'OTHER']),
  subject: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

async function nextTicketNumber(db: any): Promise<string> {
  const [row] = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM help_tickets`
  );
  const n = Number(row?.cnt ?? 0) + 1;
  return `TKT-${String(n).padStart(5, '0')}`;
}

export async function listTickets(req: Request, res: Response) {
  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: helpTickets.id,
      ticketNumber: helpTickets.ticketNumber,
      category: helpTickets.category,
      subject: helpTickets.subject,
      priority: helpTickets.priority,
      status: helpTickets.status,
      createdAt: helpTickets.createdAt,
      updatedAt: helpTickets.updatedAt,
      resolvedAt: helpTickets.resolvedAt,
      employeeId: helpTickets.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeCode: employees.employeeCode,
      assignedTo: helpTickets.assignedTo,
      commentCount: sql<number>`(
        SELECT COUNT(*) FROM help_ticket_comments htc
        WHERE htc.ticket_id = ${helpTickets.id}
        AND (${isAdmin ? sql`TRUE` : sql`htc.is_internal = FALSE`})
      )`,
    })
      .from(helpTickets)
      .innerJoin(employees, eq(helpTickets.employeeId, employees.id))
      .where(isAdmin ? sql`1=1` : eq(helpTickets.employeeId, empId!))
      .orderBy(desc(helpTickets.createdAt))
  );
  return res.json({ data: rows });
}

export async function getTicket(req: Request, res: Response) {
  const { id } = req.params;
  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  const [ticket] = await req.runInTenant!(async (db) =>
    db.select({
      id: helpTickets.id,
      ticketNumber: helpTickets.ticketNumber,
      category: helpTickets.category,
      subject: helpTickets.subject,
      description: helpTickets.description,
      priority: helpTickets.priority,
      status: helpTickets.status,
      assignedTo: helpTickets.assignedTo,
      resolvedAt: helpTickets.resolvedAt,
      createdAt: helpTickets.createdAt,
      updatedAt: helpTickets.updatedAt,
      employeeId: helpTickets.employeeId,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
    })
      .from(helpTickets)
      .innerJoin(employees, eq(helpTickets.employeeId, employees.id))
      .where(eq(helpTickets.id, id))
  );
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && ticket.employeeId !== empId) return res.status(403).json({ error: 'Forbidden' });

  const comments = await req.runInTenant!(async (db) =>
    db.select({
      id: helpTicketComments.id,
      comment: helpTicketComments.comment,
      isInternal: helpTicketComments.isInternal,
      createdAt: helpTicketComments.createdAt,
      authorName: sql<string>`COALESCE(${employees.firstName} || ' ' || ${employees.lastName}, 'HR Team')`,
      authorRole: users.role,
    })
      .from(helpTicketComments)
      .leftJoin(users, eq(helpTicketComments.authorId, users.id))
      .leftJoin(employees, eq(users.employeeId, employees.id))
      .where(and(
        eq(helpTicketComments.ticketId, id),
        isAdmin ? sql`TRUE` : eq(helpTicketComments.isInternal, false)
      ))
      .orderBy(helpTicketComments.createdAt)
  );

  return res.json({ data: { ...ticket, comments } });
}

export async function createTicket(req: Request, res: Response) {
  const empId = req.user?.employeeId;
  if (!empId) return res.status(400).json({ error: 'No employee profile' });

  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [row] = await req.runInTenant!(async (db) => {
    const ticketNumber = await nextTicketNumber(db);
    return db.insert(helpTickets).values({
      ticketNumber,
      employeeId: empId,
      category: parsed.data.category,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priority: parsed.data.priority,
    }).returning();
  });

  await req.runInTenant!(async (db) => {
    await audit({ db, userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, action: 'ticket.created', entity: 'help_tickets', entityId: row.id, details: `${row.category}: ${row.subject}` });
  });

  return res.status(201).json({ data: row });
}

export async function updateTicket(req: Request, res: Response) {
  const { id } = req.params;
  const { status, assignedTo, priority } = req.body;

  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updates: any = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo || null;
  if (priority) updates.priority = priority;
  if (status === 'RESOLVED' || status === 'CLOSED') updates.resolvedAt = new Date();

  const [row] = await req.runInTenant!(async (db) =>
    db.update(helpTickets).set(updates).where(eq(helpTickets.id, id)).returning()
  );

  if (status) {
    await req.runInTenant!(async (db) => {
      await audit({ db, userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, action: `ticket.${status.toLowerCase()}`, entity: 'help_tickets', entityId: id, details: `Status changed to ${status}` });
      const [ticket] = await db.select({ userId: users.id, subject: helpTickets.subject })
        .from(helpTickets)
        .innerJoin(users, eq(users.employeeId, helpTickets.employeeId))
        .where(eq(helpTickets.id, id));
      if (ticket) {
        await notify({ db, schemaName: req.tenant!.schemaName, userId: ticket.userId, type: 'TICKET', title: 'Ticket Updated', message: `Your ticket "${ticket.subject}" is now ${status}.`, linkPath: '/helpdesk' });
      }
    });
  }

  return res.json({ data: row });
}

export async function addComment(req: Request, res: Response) {
  const { id } = req.params;
  const { comment, isInternal } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });

  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;

  if (!isAdmin) {
    const [ticket] = await req.runInTenant!(async (db) =>
      db.select({ employeeId: helpTickets.employeeId, status: helpTickets.status })
        .from(helpTickets).where(eq(helpTickets.id, id))
    );
    if (!ticket || ticket.employeeId !== empId) return res.status(403).json({ error: 'Forbidden' });
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return res.status(400).json({ error: 'Ticket is closed' });
    }
  }

  const [row] = await req.runInTenant!(async (db) =>
    db.insert(helpTicketComments).values({
      ticketId: id,
      authorId: req.user!.userId,
      comment,
      isInternal: isAdmin && !!isInternal,
    }).returning()
  );

  // Reopen ticket if employee replies on a WAITING ticket; notify owner if HR replied
  await req.runInTenant!(async (db) => {
    if (!isAdmin) {
      await db.update(helpTickets)
        .set({ status: 'OPEN', updatedAt: new Date() })
        .where(and(eq(helpTickets.id, id), eq(helpTickets.status, 'WAITING')));
    } else if (!isInternal) {
      const [ticket] = await db.select({ userId: users.id, subject: helpTickets.subject })
        .from(helpTickets)
        .innerJoin(users, eq(users.employeeId, helpTickets.employeeId))
        .where(eq(helpTickets.id, id));
      if (ticket) {
        await notify({ db, schemaName: req.tenant!.schemaName, userId: ticket.userId, type: 'TICKET_REPLY', title: 'New Reply on Your Ticket', message: `HR responded to your ticket: "${ticket.subject}"`, linkPath: '/helpdesk' });
      }
    }
  });

  return res.status(201).json({ data: row });
}

export async function getStats(req: Request, res: Response) {
  const counts = await req.runInTenant!(async (db) =>
    db.select({
      status: helpTickets.status,
      count: sql<number>`COUNT(*)`,
    })
      .from(helpTickets)
      .groupBy(helpTickets.status)
  );
  const map: Record<string, number> = {};
  counts.forEach(r => { map[r.status] = Number(r.count); });
  return res.json({ data: map });
}
