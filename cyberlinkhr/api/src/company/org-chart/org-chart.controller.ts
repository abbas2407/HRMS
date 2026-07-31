import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { employees, departments, designations } from '../../shared/db/tenant.schema';

export async function getOrgChart(req: Request, res: Response) {
  const [depts, emps] = await Promise.all([
    req.runInTenant!(async (db) =>
      db.select({
        id: departments.id,
        name: departments.name,
        parentId: departments.parentId,
        headId: departments.headId,
      }).from(departments)
    ),
    req.runInTenant!(async (db) =>
      db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
        designationName: designations.name,
        managerId: employees.managerId,
        status: employees.status,
      })
        .from(employees)
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(eq(employees.status, 'ACTIVE'))
    ),
  ]);

  // Build department tree
  const deptMap = new Map(depts.map(d => [d.id, { ...d, children: [] as any[], members: [] as any[] }]));
  const roots: any[] = [];

  for (const d of deptMap.values()) {
    if (d.parentId && deptMap.has(d.parentId)) {
      deptMap.get(d.parentId)!.children.push(d);
    } else {
      roots.push(d);
    }
  }

  // Attach employees to their departments
  for (const e of emps) {
    const name = `${e.firstName} ${e.lastName}`;
    const node = { id: e.id, name, designation: e.designationName || '', managerId: e.managerId };
    if (e.departmentId && deptMap.has(e.departmentId)) {
      deptMap.get(e.departmentId)!.members.push(node);
    }
  }

  return res.json({ data: roots.length > 0 ? roots : [...deptMap.values()] });
}
