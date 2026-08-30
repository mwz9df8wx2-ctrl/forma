import * as z from 'zod'
import {
  projectSpecSchema,
  emptySpec,
  specReadiness,
  measurementSummary,
  furnitureCategorySchema,
  type ProjectSpec,
} from '../../../shared/src/index.ts'
import type { AuthUser } from './auth.ts'
import { db, transaction } from '../db/connection.ts'
import { badRequest, conflict, notFound } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { readJson, type RequestContext, type Router } from '../lib/http.ts'
import { requireAuth } from './auth.ts'
import { writeAudit } from '../lib/audit.ts'

/**
 * Проекты и ревизии.
 *
 * Ревизия — снимок спецификации. Пока она черновая, её можно править.
 * После согласования она блокируется: любое изменение спецификации создаёт
 * новую ревизию. Так согласованный с клиентом вариант нельзя изменить задним
 * числом, и техпакет всегда соответствует тому, что одобрили.
 */

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  category: furnitureCategorySchema.default('kitchen'),
  clientName: z.string().max(200).optional(),
  clientPhone: z.string().max(60).optional(),
  clientEmail: z.string().max(200).optional(),
  clientAddress: z.string().max(400).optional(),
})

const updateProjectSchema = createProjectSchema.partial().extend({
  assignedTo: z.string().nullish(),
})

const saveSpecSchema = z.object({
  spec: projectSpecSchema,
  /** Откуда пришли данные: ручной ввод, чат, распознавание. */
  source: z.enum(['manual', 'chat', 'ocr', 'vision']).default('manual'),
})

const approveSchema = z.object({
  optionId: z.string().nullish(),
  clientName: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
})

interface ProjectRow {
  id: string
  companyId: string
  title: string
  category: string
  status: string
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientAddress: string | null
  currentRevisionId: string | null
  selectedRevisionId: string | null
  selectedOptionId: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

const PROJECT_COLUMNS = `
  id, company_id AS companyId, title, category, status,
  client_name AS clientName, client_phone AS clientPhone,
  client_email AS clientEmail, client_address AS clientAddress,
  current_revision_id AS currentRevisionId,
  selected_revision_id AS selectedRevisionId,
  selected_option_id AS selectedOptionId,
  created_at AS createdAt, updated_at AS updatedAt, archived_at AS archivedAt
`

/** Проект компании. Чужой проект недоступен даже по прямой ссылке. */
export function loadProject(projectId: string, companyId: string): ProjectRow {
  const row = db()
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ? AND company_id = ?`)
    .get(projectId, companyId) as unknown as ProjectRow | undefined
  if (!row) throw notFound('Проект не найден')
  return row
}

interface RevisionRow {
  id: string
  projectId: string
  revisionNumber: number
  parentRevisionId: string | null
  source: string
  specSnapshot: string
  locked: number
  approvalStatus: string
  createdAt: string
}

const REVISION_COLUMNS = `
  id, project_id AS projectId, revision_number AS revisionNumber,
  parent_revision_id AS parentRevisionId, source, spec_snapshot AS specSnapshot,
  locked, approval_status AS approvalStatus, created_at AS createdAt
`

export function loadRevision(revisionId: string, projectId: string): RevisionRow {
  const row = db()
    .prepare(`SELECT ${REVISION_COLUMNS} FROM project_revisions WHERE id = ? AND project_id = ?`)
    .get(revisionId, projectId) as unknown as RevisionRow | undefined
  if (!row) throw notFound('Ревизия не найдена')
  return row
}

export function presentRevision(row: RevisionRow) {
  const spec = JSON.parse(row.specSnapshot)
  return {
    id: row.id,
    projectId: row.projectId,
    revisionNumber: row.revisionNumber,
    parentRevisionId: row.parentRevisionId,
    source: row.source,
    locked: row.locked === 1,
    approvalStatus: row.approvalStatus,
    createdAt: row.createdAt,
    spec,
    readiness: specReadiness(spec),
    // Состояние замеров идёт вместе с ревизией: экрану не нужно считать его заново,
    // и оно не может разойтись с тем, что видит сервер.
    measurements: measurementSummary(spec),
  }
}

function touchProject(projectId: string, fields: Record<string, string | null> = {}): void {
  const sets = ['updated_at = ?']
  const values: (string | null)[] = [nowIso()]
  for (const [column, value] of Object.entries(fields)) {
    sets.push(`${column} = ?`)
    values.push(value)
  }
  values.push(projectId)
  db().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

/**
 * Запись спецификации в ревизию.
 *
 * Одно правило на все источники — ручной ввод, чат, распознавание: черновая
 * ревизия правится на месте, согласованная порождает новую. Если бы каждый
 * источник писал по-своему, согласованный с клиентом вариант рано или поздно
 * изменился бы задним числом.
 */
export function writeSpecRevision(
  auth: AuthUser,
  project: ProjectRow,
  spec: ProjectSpec,
  source: string,
) {
  const snapshot = JSON.stringify(spec)

  return transaction(() => {
    const current = project.currentRevisionId
      ? loadRevision(project.currentRevisionId, project.id)
      : null

    if (current && current.locked === 0) {
      db()
        .prepare('UPDATE project_revisions SET spec_snapshot = ?, source = ? WHERE id = ?')
        .run(snapshot, source, current.id)
      touchProject(project.id, { status: 'requirements_confirmed' })
      writeAudit(auth, 'spec.updated', project.id, { revisionId: current.id })
      return {
        revision: presentRevision(loadRevision(current.id, project.id)),
        createdNewRevision: false,
      }
    }

    // Согласованную ревизию менять нельзя — создаём следующую.
    const nextNumber =
      ((db()
        .prepare('SELECT MAX(revision_number) AS n FROM project_revisions WHERE project_id = ?')
        .get(project.id) as unknown as { n: number | null }).n ?? 0) + 1
    const revisionId = createId('rev')

    db()
      .prepare(
        `INSERT INTO project_revisions
           (id, project_id, revision_number, parent_revision_id, created_by, source, spec_snapshot, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(revisionId, project.id, nextNumber, current?.id ?? null, auth.userId, source, snapshot, nowIso())

    touchProject(project.id, {
      current_revision_id: revisionId,
      status: 'requirements_confirmed',
    })
    writeAudit(auth, 'revision.created', project.id, { revisionId, number: String(nextNumber) })
    return {
      revision: presentRevision(loadRevision(revisionId, project.id)),
      createdNewRevision: true,
    }
  })
}

export function registerProjectRoutes(router: Router): void {
  router.get('/api/v1/projects', (ctx: RequestContext) => {
    const auth = requireAuth(ctx)
    const includeArchived = ctx.query.get('archived') === 'true'
    const rows = db()
      .prepare(
        `SELECT ${PROJECT_COLUMNS} FROM projects
          WHERE company_id = ? ${includeArchived ? '' : 'AND archived_at IS NULL'}
          ORDER BY updated_at DESC LIMIT 200`,
      )
      .all(auth.companyId) as unknown as ProjectRow[]
    return { projects: rows }
  })

  router.post('/api/v1/projects', async (ctx) => {
    const auth = requireAuth(ctx)
    const input = createProjectSchema.parse(await readJson(ctx.req))

    return transaction(() => {
      const now = nowIso()
      const projectId = createId('prj')
      const revisionId = createId('rev')

      db()
        .prepare(
          `INSERT INTO projects
             (id, company_id, created_by, title, category, status,
              client_name, client_phone, client_email, client_address,
              current_revision_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          auth.companyId,
          auth.userId,
          input.title,
          input.category,
          input.clientName ?? null,
          input.clientPhone ?? null,
          input.clientEmail ?? null,
          input.clientAddress ?? null,
          revisionId,
          now,
          now,
        )

      db()
        .prepare(
          `INSERT INTO project_revisions
             (id, project_id, revision_number, created_by, source, spec_snapshot, created_at)
           VALUES (?, ?, 1, ?, 'manual', ?, ?)`,
        )
        .run(revisionId, projectId, auth.userId, JSON.stringify(emptySpec(input.category)), now)

      writeAudit(auth, 'project.created', projectId, { title: input.title })
      const project = loadProject(projectId, auth.companyId)
      return { project, revision: presentRevision(loadRevision(revisionId, projectId)) }
    })
  })

  router.get('/api/v1/projects/:id', (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const revision = project.currentRevisionId
      ? presentRevision(loadRevision(project.currentRevisionId, project.id))
      : null
    return { project, revision }
  })

  router.patch('/api/v1/projects/:id', async (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const input = updateProjectSchema.parse(await readJson(ctx.req))

    const columns: Record<string, string | null> = {}
    if (input.title !== undefined) columns.title = input.title
    if (input.clientName !== undefined) columns.client_name = input.clientName ?? null
    if (input.clientPhone !== undefined) columns.client_phone = input.clientPhone ?? null
    if (input.clientEmail !== undefined) columns.client_email = input.clientEmail ?? null
    if (input.clientAddress !== undefined) columns.client_address = input.clientAddress ?? null
    if (input.assignedTo !== undefined) columns.assigned_to = input.assignedTo ?? null
    if (Object.keys(columns).length === 0) throw badRequest('Нечего обновлять')

    touchProject(project.id, columns)
    writeAudit(auth, 'project.updated', project.id, columns)
    return { project: loadProject(project.id, auth.companyId) }
  })

  router.delete('/api/v1/projects/:id', (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    touchProject(project.id, { archived_at: nowIso(), status: 'archived' })
    writeAudit(auth, 'project.archived', project.id, null)
    return { ok: true }
  })

  router.get('/api/v1/projects/:id/revisions', (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const rows = db()
      .prepare(
        `SELECT ${REVISION_COLUMNS} FROM project_revisions
          WHERE project_id = ? ORDER BY revision_number DESC`,
      )
      .all(project.id) as unknown as RevisionRow[]
    return { revisions: rows.map(presentRevision) }
  })

  /**
   * Сохранение спецификации.
   * Черновая ревизия правится на месте, согласованная — порождает новую.
   */
  router.post('/api/v1/projects/:id/spec', async (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const input = saveSpecSchema.parse(await readJson(ctx.req))
    return writeSpecRevision(auth, project, input.spec, input.source)
  })

  /** Согласование: ревизия блокируется, дальше только новая. */
  router.post('/api/v1/projects/:id/revisions/:revisionId/approve', async (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const revision = loadRevision(ctx.params.revisionId, project.id)
    const input = approveSchema.parse(await readJson(ctx.req).catch(() => ({})))

    if (revision.locked === 1) throw conflict('Ревизия уже согласована')
    const readiness = specReadiness(JSON.parse(revision.specSnapshot))
    if (!readiness.ready) {
      throw badRequest(`Спецификация не заполнена: ${readiness.missing.join(', ')}`)
    }

    return transaction(() => {
      db()
        .prepare("UPDATE project_revisions SET locked = 1, approval_status = 'approved' WHERE id = ?")
        .run(revision.id)
      db()
        .prepare(
          `INSERT INTO project_approvals
             (id, project_id, revision_id, option_id, approved_by, client_name, note, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          createId('apr'),
          project.id,
          revision.id,
          input.optionId ?? null,
          auth.userId,
          input.clientName ?? project.clientName,
          input.note ?? null,
          nowIso(),
        )
      touchProject(project.id, {
        status: 'client_approved',
        selected_revision_id: revision.id,
        selected_option_id: input.optionId ?? null,
      })
      writeAudit(auth, 'revision.approved', project.id, { revisionId: revision.id })
      return { revision: presentRevision(loadRevision(revision.id, project.id)) }
    })
  })
}
