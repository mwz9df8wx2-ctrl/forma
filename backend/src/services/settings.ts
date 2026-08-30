import { db } from '../db/connection.ts'
import { nowIso } from '../lib/ids.ts'
import {
  budgetLimitsSchema,
  creditCostsSchema,
  defaultBudgetLimits,
  defaultCreditCosts,
  type BudgetLimits,
  type CreditCosts,
  type GenerationQuality,
} from '../../../shared/src/index.ts'

/**
 * Настройки платформы: стоимость операций и жёсткие бюджеты.
 *
 * Живут в базе, чтобы администратор менял цены без пересборки приложения.
 * Если записи нет — берутся значения по умолчанию, а не ноль: обнулённая
 * цена означала бы бесплатную генерацию, что дороже обходится.
 */

const CREDIT_COSTS_KEY = 'credit_costs'
const BUDGET_LIMITS_KEY = 'budget_limits'

function readSetting(key: string): unknown {
  const row = db().prepare('SELECT value FROM platform_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  if (!row) return undefined
  try {
    return JSON.parse(row.value)
  } catch {
    return undefined
  }
}

function writeSetting(key: string, value: unknown): void {
  db()
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), nowIso())
}

export function creditCosts(): CreditCosts {
  const stored = readSetting(CREDIT_COSTS_KEY)
  if (stored === undefined) return defaultCreditCosts()
  const parsed = creditCostsSchema.safeParse(stored)
  return parsed.success ? parsed.data : defaultCreditCosts()
}

export function budgetLimits(): BudgetLimits {
  const stored = readSetting(BUDGET_LIMITS_KEY)
  if (stored === undefined) return defaultBudgetLimits()
  const parsed = budgetLimitsSchema.safeParse(stored)
  return parsed.success ? parsed.data : defaultBudgetLimits()
}

export function setCreditCosts(patch: Partial<CreditCosts>): CreditCosts {
  const next = creditCostsSchema.parse({ ...creditCosts(), ...patch })
  writeSetting(CREDIT_COSTS_KEY, next)
  return next
}

export function setBudgetLimits(patch: Partial<BudgetLimits>): BudgetLimits {
  const next = budgetLimitsSchema.parse({ ...budgetLimits(), ...patch })
  writeSetting(BUDGET_LIMITS_KEY, next)
  return next
}

/** Сколько кредитов стоит задание: цена качества умножается на число вариантов. */
export function jobCost(quality: GenerationQuality, variants: number): number {
  const costs = creditCosts()
  const perVariant = quality === 'final' ? costs.final : quality === 'refine' ? costs.refine : costs.preview
  return perVariant * variants
}
