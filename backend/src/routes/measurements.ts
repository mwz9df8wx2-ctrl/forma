import * as z from 'zod'
import { db, transaction } from '../db/connection.ts'
import { badRequest, paymentRequired } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { readJson, type Router } from '../lib/http.ts'
import { writeAudit } from '../lib/audit.ts'
import { requireAuth, requirePermission } from './auth.ts'
import { loadProject, loadRevision, writeSpecRevision } from './projects.ts'
import { applyMeasurements, describeSuggestions } from '../services/measurements.ts'
import { parseText } from '../services/parser.ts'
import {
  commitReservation,
  readWallet,
  refundReservation,
  reserveCredits,
} from '../services/credits.ts'
import { assertWithinBudgets } from '../services/limits.ts'
import { creditCosts } from '../services/settings.ts'
import {
  measurementChecklist,
  measurementSummary,
  projectSpecSchema,
  type ProjectSpec,
} from '../../../shared/src/index.ts'

/**
 * Замеры и диалог уточнения.
 *
 * Разбор ничего не записывает сам. Он предлагает, человек подтверждает —
 * и только после подтверждения значение получает статус «замер». По этому
 * числу потом пилят столешницу, и ошибка в нём необратима.
 */

const parseSchema = z.object({
  text: z.string().min(2).max(4000),
  /** Разбор моделью стоит кредит. Правила работают всегда и бесплатно. */
  useAi: z.boolean().default(false),
})

const applySchema = z.object({
  accepted: z
    .array(z.object({ id: z.string().max(80), value: z.int().min(0).max(20000) }))
    .min(1)
    .max(40),
})

function currentSpec(projectId: string, revisionId: string | null): ProjectSpec {
  if (!revisionId) throw badRequest('У проекта нет сохранённой спецификации')
  const revision = loadRevision(revisionId, projectId)
  return projectSpecSchema.parse(JSON.parse(revision.specSnapshot))
}

function saveMessage(input: {
  companyId: string
  projectId: string
  userId: string | null
  role: string
  text: string
  suggestions: unknown
  source: string
}): void {
  db()
    .prepare(
      `INSERT INTO project_messages
         (id, company_id, project_id, user_id, role, text, suggestions, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      createId('msg'),
      input.companyId,
      input.projectId,
      input.userId,
      input.role,
      input.text,
      JSON.stringify(input.suggestions),
      input.source,
      nowIso(),
    )
}

export function registerMeasurementRoutes(router: Router): void {
  /** Лист замеров: что нужно, что уже есть и с каким статусом. */
  router.get('/api/v1/projects/:id/measurements', (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const spec = currentSpec(project.id, project.currentRevisionId)
    return {
      checklist: measurementChecklist(spec),
      summary: measurementSummary(spec),
    }
  })

  router.get('/api/v1/projects/:id/messages', (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const rows = db()
      .prepare(
        `SELECT id, role, text, suggestions, source, created_at AS createdAt
           FROM project_messages WHERE project_id = ? AND company_id = ?
          ORDER BY created_at LIMIT 200`,
      )
      .all(project.id, auth.companyId) as unknown as {
      id: string
      role: string
      text: string
      suggestions: string
      source: string
      createdAt: string
    }[]

    return {
      messages: rows.map((row) => ({
        ...row,
        suggestions: JSON.parse(row.suggestions),
      })),
    }
  })

  /**
   * Разбор текста в предложения. Спецификацию не меняет.
   * Модель подключается по запросу и стоит кредит; правила работают всегда.
   */
  router.post('/api/v1/projects/:id/measurements/parse', async (ctx) => {
    const auth = requirePermission(ctx, 'measurement.edit')
    const project = loadProject(ctx.params.id, auth.companyId)
    const input = parseSchema.parse(await readJson(ctx.req))
    const spec = currentSpec(project.id, project.currentRevisionId)

    const cost = creditCosts().analyze
    const operationId = createId('prs')
    let reserved = false

    if (input.useAi && cost > 0) {
      // Тот же порядок, что и у генерации: кредиты и бюджет проверяются
      // до обращения к провайдеру, а не после.
      transaction(() => {
        if (readWallet(auth.companyId).available < cost) {
          throw paymentRequired(
            'AI-кредиты закончились. Разбор по правилам и ручной ввод продолжают работать.',
          )
        }
        assertWithinBudgets(auth.companyId, auth.userId, 0)
        reserveCredits({
          companyId: auth.companyId,
          userId: auth.userId,
          projectId: project.id,
          jobId: operationId,
          credits: cost,
          estimatedCostKopecks: 0,
          provider: 'anthropic',
          model: null,
        })
      })
      reserved = true
    }

    let outcome
    try {
      outcome = await parseText(spec, input.text, input.useAi)
    } catch (error) {
      if (reserved) {
        transaction(() => refundReservation(auth.companyId, operationId, 'сбой разбора'))
      }
      throw error
    }

    if (reserved) {
      // Модель не участвовала — брать за это кредит не за что.
      transaction(() =>
        outcome.usedModel
          ? commitReservation(auth.companyId, operationId, 0)
          : refundReservation(auth.companyId, operationId, 'модель не участвовала в разборе'),
      )
    }

    const suggestions = describeSuggestions(spec, outcome.suggestions)
    saveMessage({
      companyId: auth.companyId,
      projectId: project.id,
      userId: auth.userId,
      role: 'user',
      text: input.text,
      suggestions,
      source: outcome.usedModel ? 'model' : 'rules',
    })

    return {
      suggestions,
      usedModel: outcome.usedModel,
      wallet: readWallet(auth.companyId),
      checklist: measurementChecklist(spec),
      summary: measurementSummary(spec),
    }
  })

  /** Подтверждение значений: только отсюда они попадают в спецификацию. */
  router.post('/api/v1/projects/:id/measurements/apply', async (ctx) => {
    const auth = requirePermission(ctx, 'measurement.edit')
    const project = loadProject(ctx.params.id, auth.companyId)
    const input = applySchema.parse(await readJson(ctx.req))
    const spec = currentSpec(project.id, project.currentRevisionId)

    const known = new Set(measurementChecklist(spec).map((item) => item.id))
    const unknown = input.accepted.filter((item) => !known.has(item.id))
    if (unknown.length > 0) {
      throw badRequest(`Неизвестный замер: ${unknown.map((item) => item.id).join(', ')}`)
    }

    const next = applyMeasurements(spec, input.accepted)
    const result = writeSpecRevision(auth, project, next, 'chat')

    writeAudit(auth, 'measurements.applied', project.id, {
      count: input.accepted.length,
      ids: input.accepted.map((item) => item.id).join(','),
    })
    saveMessage({
      companyId: auth.companyId,
      projectId: project.id,
      userId: auth.userId,
      role: 'system',
      text: `Подтверждено значений: ${input.accepted.length}`,
      suggestions: input.accepted,
      source: 'apply',
    })

    return {
      ...result,
      checklist: measurementChecklist(next),
      summary: measurementSummary(next),
    }
  })
}
