import { Request, Response, NextFunction } from 'express';
import { sql } from 'drizzle-orm';

const AUDITED_MODULES = ['employees', 'assets', 'leave', 'grievances'];

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const parts = req.originalUrl.split('?')[0].split('/');
  const apiIndex = parts.indexOf('api');
  if (apiIndex === -1 || apiIndex >= parts.length - 2) {
    return next();
  }

  const module = parts[apiIndex + 1];
  const id = parts[apiIndex + 2];

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id) || !AUDITED_MODULES.includes(module)) {
    return next();
  }

  const tableName = module === 'leave' ? 'leave_requests' : module;

  req.runInTenant!(async (db) => {
    try {
      const { rows } = await db.execute(sql`SELECT * FROM ${sql.identifier(req.tenant!.schemaName)}.${sql.identifier(tableName)} WHERE id = ${id}::uuid`);
      const before = rows[0];
      if (!before) {
        return next();
      }

      const originalJson = res.json;
      res.json = function (body: any) {
        res.json = originalJson;

        // Perform async after-check
        req.runInTenant!(async (db2) => {
          try {
            const { rows: afterRows } = await db2.execute(sql`SELECT * FROM ${sql.identifier(req.tenant!.schemaName)}.${sql.identifier(tableName)} WHERE id = ${id}::uuid`);
            const after = afterRows[0];
            if (after) {
              await db2.execute(sql`
                INSERT INTO ${sql.identifier(req.tenant!.schemaName)}.${sql.identifier('versions')} (module, record_id, data_before, data_after, changed_by)
                VALUES (${module}, ${id}, ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${req.user?.userId || null})
              `);
            }
          } catch (err) {
            console.error('Audit version log after-save query failed:', err);
          }
        });

        return originalJson.call(this, body);
      };

      next();
    } catch (e) {
      next();
    }
  });
}
