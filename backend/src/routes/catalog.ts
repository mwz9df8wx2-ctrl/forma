import {
  catalogItemInputSchema,
  catalogTypeSchema,
  defaultProductionProfile,
  parseCatalogAttributes,
  productionProfileSchema,
} from '../../../shared/src/index.ts'
import { db } from '../db/connection.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { readJson, type Router } from '../lib/http.ts'
import { requireAuth } from './auth.ts'
import { writeAudit } from '../lib/audit.ts'

/**
 * Каталог компании и производственный профиль.
 *
 * Всё, что приложение предлагает клиенту, берётся отсюда. Записи принадлежат
 * компании: чужой каталог не читается и не правится.
 */

interface CatalogRow {
  id: string
  companyId: string
  type: string
  sku: string
  name: string
  attributes: string
  purchasePriceKopecks: number | null
  salePriceKopecks: number | null
  priceUnit: string
  active: number
  demo: number
  createdAt: string
  updatedAt: string
}

const COLUMNS = `
  id, company_id AS companyId, type, sku, name, attributes,
  purchase_price_kopecks AS purchasePriceKopecks, sale_price_kopecks AS salePriceKopecks,
  price_unit AS priceUnit,
  active, demo, created_at AS createdAt, updated_at AS updatedAt
`

function present(row: CatalogRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    type: row.type,
    sku: row.sku,
    name: row.name,
    attributes: JSON.parse(row.attributes),
    purchasePriceKopecks: row.purchasePriceKopecks,
    salePriceKopecks: row.salePriceKopecks,
    priceUnit: row.priceUnit,
    active: row.active === 1,
    demo: row.demo === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const updateSchema = catalogItemInputSchema.partial().omit({ type: true })

export function registerCatalogRoutes(router: Router): void {
  router.get('/api/v1/catalog', (ctx) => {
    const auth = requireAuth(ctx)
    const type = ctx.query.get('type')
    const includeInactive = ctx.query.get('inactive') === 'true'

    const conditions = ['company_id = ?']
    const values: (string | number)[] = [auth.companyId]
    if (type) {
      conditions.push('type = ?')
      values.push(catalogTypeSchema.parse(type))
    }
    if (!includeInactive) conditions.push('active = 1')

    const rows = db()
      .prepare(
        `SELECT ${COLUMNS} FROM catalog_items
          WHERE ${conditions.join(' AND ')}
          ORDER BY type, name LIMIT 1000`,
      )
      .all(...values) as unknown as CatalogRow[]
    return { items: rows.map(present) }
  })

  router.post('/api/v1/catalog', async (ctx) => {
    const auth = requireAuth(ctx)
    const input = catalogItemInputSchema.parse(await readJson(ctx.req))
    // Атрибуты проверяются схемой своего типа: чужие поля не пройдут.
    const attributes = parseCatalogAttributes(input.type, input.attributes)

    const id = createId('cat')
    const now = nowIso()
    db()
      .prepare(
        `INSERT INTO catalog_items
           (id, company_id, type, sku, name, attributes, purchase_price_kopecks,
            sale_price_kopecks, price_unit, active, demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        auth.companyId,
        input.type,
        input.sku,
        input.name,
        JSON.stringify(attributes),
        input.purchasePriceKopecks,
        input.salePriceKopecks,
        input.priceUnit,
        input.active ? 1 : 0,
        input.demo ? 1 : 0,
        now,
        now,
      )

    writeAudit(auth, 'catalog.created', null, { id, type: input.type, name: input.name })
    const row = db()
      .prepare(`SELECT ${COLUMNS} FROM catalog_items WHERE id = ?`)
      .get(id) as unknown as CatalogRow
    return { item: present(row) }
  })

  router.patch('/api/v1/catalog/:id', async (ctx) => {
    const auth = requireAuth(ctx)
    const existing = db()
      .prepare(`SELECT ${COLUMNS} FROM catalog_items WHERE id = ? AND company_id = ?`)
      .get(ctx.params.id, auth.companyId) as unknown as CatalogRow | undefined
    if (!existing) throw notFound('Запись каталога не найдена')

    const input = updateSchema.parse(await readJson(ctx.req))
    const sets: string[] = ['updated_at = ?']
    const values: (string | number | null)[] = [nowIso()]

    if (input.name !== undefined) {
      sets.push('name = ?')
      values.push(input.name)
    }
    if (input.sku !== undefined) {
      sets.push('sku = ?')
      values.push(input.sku)
    }
    if (input.purchasePriceKopecks !== undefined) {
      sets.push('purchase_price_kopecks = ?')
      values.push(input.purchasePriceKopecks)
    }
    if (input.salePriceKopecks !== undefined) {
      sets.push('sale_price_kopecks = ?')
      values.push(input.salePriceKopecks)
    }
    if (input.priceUnit !== undefined) {
      sets.push('price_unit = ?')
      values.push(input.priceUnit)
    }
    if (input.active !== undefined) {
      sets.push('active = ?')
      values.push(input.active ? 1 : 0)
    }
    if (input.attributes !== undefined) {
      const attributes = parseCatalogAttributes(
        catalogTypeSchema.parse(existing.type),
        input.attributes,
      )
      sets.push('attributes = ?')
      values.push(JSON.stringify(attributes))
    }
    if (sets.length === 1) throw badRequest('Нечего обновлять')

    values.push(existing.id)
    db().prepare(`UPDATE catalog_items SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    writeAudit(auth, 'catalog.updated', null, { id: existing.id })

    const row = db()
      .prepare(`SELECT ${COLUMNS} FROM catalog_items WHERE id = ?`)
      .get(existing.id) as unknown as CatalogRow
    return { item: present(row) }
  })

  /** Запись не удаляется, а выключается: на неё могут ссылаться старые ревизии. */
  router.delete('/api/v1/catalog/:id', (ctx) => {
    const auth = requireAuth(ctx)
    const result = db()
      .prepare('UPDATE catalog_items SET active = 0, updated_at = ? WHERE id = ? AND company_id = ?')
      .run(nowIso(), ctx.params.id, auth.companyId)
    if (result.changes === 0) throw notFound('Запись каталога не найдена')
    writeAudit(auth, 'catalog.disabled', null, { id: ctx.params.id })
    return { ok: true }
  })

  router.get('/api/v1/production-profile', (ctx) => {
    const auth = requireAuth(ctx)
    const row = db()
      .prepare(
        `SELECT id, name, settings FROM production_profiles
          WHERE company_id = ? ORDER BY is_default DESC, created_at LIMIT 1`,
      )
      .get(auth.companyId) as unknown as { id: string; name: string; settings: string } | undefined

    if (!row) return { profile: defaultProductionProfile(), isDefault: true }
    return { profile: productionProfileSchema.parse(JSON.parse(row.settings)), isDefault: false }
  })

  router.patch('/api/v1/production-profile', async (ctx) => {
    const auth = requireAuth(ctx)
    const input = productionProfileSchema.parse(await readJson(ctx.req))
    const existing = db()
      .prepare('SELECT id FROM production_profiles WHERE company_id = ? ORDER BY is_default DESC LIMIT 1')
      .get(auth.companyId) as unknown as { id: string } | undefined

    if (existing) {
      db()
        .prepare('UPDATE production_profiles SET settings = ? WHERE id = ?')
        .run(JSON.stringify(input), existing.id)
    } else {
      db()
        .prepare(
          `INSERT INTO production_profiles (id, company_id, name, settings, is_default, created_at)
           VALUES (?, ?, 'Основной', ?, 1, ?)`,
        )
        .run(createId('prf'), auth.companyId, JSON.stringify(input), nowIso())
    }

    writeAudit(auth, 'profile.updated', null, null)
    return { profile: input }
  })
}
