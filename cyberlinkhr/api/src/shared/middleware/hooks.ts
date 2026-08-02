import { Request, Response, NextFunction } from 'express';
import { runHooks } from '../framework/hooks';

const URL_TO_DOCTYPE: Record<string, string> = {
  'employees': 'employee',
  'leave': 'leave',
  'payroll': 'payroll',
  'attendance': 'attendance',
  'assets': 'asset',
  'grievances': 'grievance',
};

export async function hooksMiddleware(req: Request, res: Response, next: NextFunction) {
  const parts = req.originalUrl.split('?')[0].split('/');
  const apiIndex = parts.indexOf('api');
  if (apiIndex === -1 || apiIndex >= parts.length - 1) {
    return next();
  }

  const module = parts[apiIndex + 1];
  const doctype = URL_TO_DOCTYPE[module];

  if (!doctype) {
    return next();
  }

  req.runInTenant!(async (db) => {
    try {
      const isCreate = req.method === 'POST';
      const isUpdate = req.method === 'PUT' || req.method === 'PATCH';
      const isDelete = req.method === 'DELETE';

      // 1. beforeDelete
      if (isDelete) {
        await runHooks(doctype, 'beforeDelete', { id: parts[apiIndex + 2] }, { db, req });
      }

      // 2. beforeSave / beforeSubmit
      if (isCreate || isUpdate) {
        // If status changes to lock/submitted
        if (req.body.status === 'LOCKED' || req.body.status === 'SUBMITTED') {
          await runHooks(doctype, 'beforeSubmit', req.body, { db, req });
        }
        await runHooks(doctype, 'beforeSave', req.body, { db, req });
      }

      const originalJson = res.json;
      res.json = function (body: any) {
        res.json = originalJson;
        const savedDoc = body.data || body;

        req.runInTenant!(async (db2) => {
          try {
            if (isDelete) {
              await runHooks(doctype, 'afterDelete', savedDoc, { db: db2, req });
            } else if (isCreate || isUpdate) {
              if (savedDoc.status === 'LOCKED' || savedDoc.status === 'SUBMITTED') {
                await runHooks(doctype, 'afterSubmit', savedDoc, { db: db2, req });
              }
              await runHooks(doctype, 'afterSave', savedDoc, { db: db2, req });

              // Check if status changed (requires comparing request body or previous state)
              if (req.body.status && req.body.status !== savedDoc.status) {
                await runHooks(doctype, 'onStatusChange', savedDoc, { db: db2, req });
              } else if (isUpdate) {
                // If it is an update, we assume it can be a status change
                await runHooks(doctype, 'onStatusChange', savedDoc, { db: db2, req });
              }
            }
          } catch (err) {
            console.error(`Post-write hook execution failed for ${doctype}:`, err);
          }
        });

        return originalJson.call(this, body);
      };

      next();
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });
}
