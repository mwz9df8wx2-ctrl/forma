import { db } from '../db/connection.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { ensureWallet, grantCredits } from './credits.ts'

/**
 * Тарифы и подписки.
 *
 * Цена — в копейках: 2990 ₽ хранятся как 299000, а не как 2990.0.
 * Кредиты начисляются подпиской и живут отдельно от денег, чтобы поддержка
 * могла добавить их вручную, не трогая оплату.
 */

export interface PlanRow {
  id: string
  name: string
  monthlyPrice: number
  includedCredits: number
  maxUsers: number
}

const DEFAULT_PLANS: PlanRow[] = [
  { id: 'plan_trial', name: 'Пробный', monthlyPrice: 0, includedCredits: 10, maxUsers: 2 },
  { id: 'plan_master', name: 'Мастер', monthlyPrice: 299_000, includedCredits: 60, maxUsers: 5 },
  { id: 'plan_studio', name: 'Студия', monthlyPrice: 749_000, includedCredits: 200, maxUsers: 15 },
]

export function ensurePlans(): void {
  const now = nowIso()
  for (const plan of DEFAULT_PLANS) {
    db()
      .prepare(
        `INSERT INTO plans (id, name, monthly_price, included_credits, max_users, features, active, created_at)
         VALUES (?, ?, ?, ?, ?, '{}', 1, ?) ON CONFLICT(id) DO NOTHING`,
      )
      .run(plan.id, plan.name, plan.monthlyPrice, plan.includedCredits, plan.maxUsers, now)
  }
}

export function listPlans(): PlanRow[] {
  ensurePlans()
  return db()
    .prepare(
      `SELECT id, name, monthly_price AS monthlyPrice, included_credits AS includedCredits,
              max_users AS maxUsers FROM plans WHERE active = 1 ORDER BY monthly_price`,
    )
    .all() as unknown as PlanRow[]
}

export interface CompanySubscription {
  planId: string
  planName: string
  status: string
  periodStart: string
  periodEnd: string
  maxUsers: number
}

export function readSubscription(companyId: string): CompanySubscription | null {
  const row = db()
    .prepare(
      `SELECT s.plan_id AS planId, p.name AS planName, s.status, s.period_start AS periodStart,
              s.period_end AS periodEnd, p.max_users AS maxUsers
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.company_id = ? AND s.status = 'active'
        ORDER BY s.created_at DESC LIMIT 1`,
    )
    .get(companyId) as unknown as CompanySubscription | undefined
  return row ?? null
}

/**
 * Подписка новой компании: пробный тариф и стартовые кредиты.
 * Регистрация без кредитов означала бы, что первый же запуск упирается
 * в оплату — так продукт не показать.
 */
export function startTrial(companyId: string): void {
  ensurePlans()
  ensureWallet(companyId)
  if (readSubscription(companyId)) return

  const plan = DEFAULT_PLANS[0]
  const now = new Date()
  const end = new Date(now)
  end.setUTCMonth(end.getUTCMonth() + 1)

  db()
    .prepare(
      `INSERT INTO subscriptions (id, company_id, plan_id, status, period_start, period_end, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(createId('sub'), companyId, plan.id, now.toISOString(), end.toISOString(), nowIso())

  grantCredits(companyId, plan.includedCredits, 'grant')
}
