import { db } from '../db/connection.ts'
import { createId, nowIso } from './ids.ts'
import type { AuthUser } from '../routes/auth.ts'

/** Журнал действий: нужен для поддержки, разбора споров и аналитики. */
export function writeAudit(
  auth: AuthUser,
  action: string,
  projectId: string | null,
  details: Record<string, unknown> | null,
): void {
  db()
    .prepare(
      `INSERT INTO audit_log (id, company_id, user_id, project_id, action, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      createId('aud'),
      auth.companyId,
      auth.userId,
      projectId,
      action,
      details ? JSON.stringify(details) : null,
      nowIso(),
    )
}
