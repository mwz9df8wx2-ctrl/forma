import * as z from 'zod'
import { db } from '../db/connection.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { readJson, type Router } from '../lib/http.ts'
import { writeAudit } from '../lib/audit.ts'
import { requireAuth } from './auth.ts'
import { loadProject } from './projects.ts'
import {
  estimateRequestLineSchema,
  lineTotalKopecks,
  summariseEstimate,
  type EstimateLine,
} from '../../../shared/src/index.ts'

/**
 * Смета.
 *
 * Количества приходят из раскроя, который считает приложение по той же
 * геометрии, что и чертежи. Цены подставляет сервер из каталога компании:
 * цена, пришедшая из браузера, — это не цена, а пожелание.
 *
 * Результат сохраняется снимком. Материал подорожает, каталог поправят,
 * а согласованная с клиентом смета обязана остаться той же — иначе спорить
 * о сумме будет не с чем.
 */

const createSchema = z.object({
  lines: z.array(estimateRequestLineSchema).min(1).max(300),
  /** Наценка компании в целых процентах. */
  markupPercent: z.int().min(0).max(500).default(0),
})

interface EstimateRow {
  id: string
  projectId: string
  revisionId: string
  lines: string
  totals: string
  markupPercent: number
  createdAt: string
}

const COLUMNS = `
  id, project_id AS projectId, revision_id AS revisionId, lines, totals,
  markup_percent AS markupPercent, created_at AS createdAt
`

function present(row: EstimateRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    revisionId: row.revisionId,
    markupPercent: row.markupPercent,
    lines: JSON.parse(row.lines),
    totals: JSON.parse(row.totals),
    createdAt: row.createdAt,
  }
}

/** Цена за единицу на момент расчёта. Берётся только из каталога компании. */
function priceOf(catalogItemId: string | null, companyId: string): number | null {
  if (!catalogItemId) return null
  const row = db()
    .prepare(
      `SELECT sale_price_kopecks AS sale, purchase_price_kopecks AS purchase
         FROM catalog_items WHERE id = ? AND company_id = ?`,
    )
    .get(catalogItemId, companyId) as unknown as
    | { sale: number | null; purchase: number | null }
    | undefined
  if (!row) return null
  // Продажная цена — то, что видит клиент. Закупочная нужна, когда продажная
  // ещё не назначена: лучше показать хоть какую-то, чем ноль.
  return row.sale ?? row.purchase ?? null
}

export function registerEstimateRoutes(router: Router): void {
  router.post('/api/v1/projects/:id/estimates', async (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    if (!project.currentRevisionId) throw badRequest('У проекта нет сохранённой спецификации')
    const input = createSchema.parse(await readJson(ctx.req))

    const lines: EstimateLine[] = input.lines.map((line) => {
      const price = priceOf(line.catalogItemId, auth.companyId)
      return {
        ...line,
        unitPriceKopecks: price ?? 0,
        totalKopecks: price === null ? 0 : lineTotalKopecks(line.quantityMilli, price),
        priceMissing: price === null,
      }
    })

    const totals = summariseEstimate(lines, input.markupPercent)
    const id = createId('est')

    db()
      .prepare(
        `INSERT INTO estimates
           (id, company_id, project_id, revision_id, created_by, lines, totals, markup_percent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        auth.companyId,
        project.id,
        project.currentRevisionId,
        auth.userId,
        JSON.stringify(lines),
        JSON.stringify(totals),
        input.markupPercent,
        nowIso(),
      )

    writeAudit(auth, 'estimate.created', project.id, {
      estimateId: id,
      total: totals.totalKopecks,
      missingPrices: totals.missingPrices,
    })

    const row = db().prepare(`SELECT ${COLUMNS} FROM estimates WHERE id = ?`).get(id) as unknown as EstimateRow
    return { estimate: present(row) }
  })

  router.get('/api/v1/projects/:id/estimates', (ctx) => {
    const auth = requireAuth(ctx)
    const project = loadProject(ctx.params.id, auth.companyId)
    const rows = db()
      .prepare(
        `SELECT ${COLUMNS} FROM estimates WHERE project_id = ? AND company_id = ?
          ORDER BY created_at DESC LIMIT 20`,
      )
      .all(project.id, auth.companyId) as unknown as EstimateRow[]
    return { estimates: rows.map(present) }
  })

  router.get('/api/v1/estimates/:id', (ctx) => {
    const auth = requireAuth(ctx)
    const row = db()
      .prepare(`SELECT ${COLUMNS} FROM estimates WHERE id = ? AND company_id = ?`)
      .get(ctx.params.id, auth.companyId) as unknown as EstimateRow | undefined
    if (!row) throw notFound('Смета не найдена')
    return { estimate: present(row) }
  })
}
