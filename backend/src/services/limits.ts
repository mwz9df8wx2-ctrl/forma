import { db } from '../db/connection.ts'
import { tooManyRequests, unavailable } from '../lib/errors.ts'
import { budgetLimits } from './settings.ts'

/**
 * Жёсткие лимиты на стороне сервера.
 *
 * Клиент про них только читает. Любая проверка, которую можно обойти,
 * заменой запроса из браузера — не защита, а украшение.
 *
 * Считаем не по кредитам, а по деньгам провайдера: кредиты можно подарить,
 * счёт от провайдера приходит настоящий.
 */

function startOfUtcDay(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function startOfUtcMonth(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/**
 * Потраченное у провайдера за период.
 * Пока задание не завершилось, факт неизвестен — берём оценку,
 * чтобы одновременные запуски не пробили лимит скопом.
 */
function spentKopecks(since: string, filter: { companyId?: string; userId?: string }): number {
  const clauses = ["type IN ('reserve', 'charge')", "status != 'refunded'", 'created_at >= ?']
  const args: unknown[] = [since]
  if (filter.companyId) {
    clauses.push('company_id = ?')
    args.push(filter.companyId)
  }
  if (filter.userId) {
    clauses.push('user_id = ?')
    args.push(filter.userId)
  }
  const row = db()
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(actual_cost_kopecks, estimated_cost_kopecks)), 0) AS total
       FROM usage_transactions WHERE ${clauses.join(' AND ')}`,
    )
    .get(...(args as never[])) as unknown as { total: number }
  return row.total
}

export interface BudgetUsage {
  userMonth: number
  companyMonth: number
  globalDay: number
  globalMonth: number
}

export function budgetUsage(companyId: string, userId: string): BudgetUsage {
  const month = startOfUtcMonth()
  const day = startOfUtcDay()
  return {
    userMonth: spentKopecks(month, { userId }),
    companyMonth: spentKopecks(month, { companyId }),
    globalDay: spentKopecks(day, {}),
    globalMonth: spentKopecks(month, {}),
  }
}

/**
 * Проверка бюджетов до обращения к провайдеру.
 * Сообщения разные: пользователю важно понимать, упёрся он сам
 * или платформа целиком.
 */
export function assertWithinBudgets(
  companyId: string,
  userId: string,
  estimatedCostKopecks: number,
): void {
  const limits = budgetLimits()
  const usage = budgetUsage(companyId, userId)

  if (usage.userMonth + estimatedCostKopecks > limits.perUserMonthlyKopecks) {
    throw tooManyRequests('Исчерпан месячный лимит генераций для вашей учётной записи.')
  }
  if (usage.companyMonth + estimatedCostKopecks > limits.perCompanyMonthlyKopecks) {
    throw tooManyRequests('Исчерпан месячный лимит генераций компании.')
  }
  if (usage.globalDay + estimatedCostKopecks > limits.globalDailyKopecks) {
    throw unavailable('Дневной лимит генераций платформы исчерпан. Попробуйте завтра.')
  }
  if (usage.globalMonth + estimatedCostKopecks > limits.globalMonthlyKopecks) {
    throw unavailable('Месячный лимит генераций платформы исчерпан.')
  }
}

/** Одновременные задания компании: очередь не должна расти без границ. */
export function assertConcurrency(companyId: string): void {
  const limits = budgetLimits()
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS count FROM generation_jobs
       WHERE company_id = ? AND status NOT IN ('completed', 'failed')`,
    )
    .get(companyId) as unknown as { count: number }
  if (row.count >= limits.maxConcurrentJobsPerCompany) {
    throw tooManyRequests(
      `Одновременно считается не больше ${limits.maxConcurrentJobsPerCompany} визуализаций. Дождитесь завершения.`,
    )
  }
}

/** Частота запусков: защита от зажатой кнопки и от скрипта. */
export function assertRateLimit(companyId: string): void {
  const limits = budgetLimits()
  const since = new Date(Date.now() - 60_000).toISOString()
  const row = db()
    .prepare('SELECT COUNT(*) AS count FROM generation_jobs WHERE company_id = ? AND created_at >= ?')
    .get(companyId, since) as unknown as { count: number }
  if (row.count >= limits.maxJobsPerMinutePerCompany) {
    throw tooManyRequests('Слишком много запусков подряд. Подождите минуту.')
  }
}
