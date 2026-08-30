import { db } from '../db/connection.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { conflict } from '../lib/errors.ts'
import type { UsageTransaction, UsageType, Wallet } from '../../../shared/src/index.ts'

/**
 * Кошелёк кредитов и журнал операций.
 *
 * Правила, из которых всё остальное следует:
 *  1. Баланс никогда не меняется отдельно от записи в журнале.
 *     Сумма всех credit_delta компании обязана равняться её балансу.
 *  2. Кредиты списываются ДО обращения к провайдеру. Иначе при сбое сети
 *     мы платим деньгами, а пользователь не платит кредитами.
 *  3. Резерв не пропадает: задание либо превращает его в списание,
 *     либо возвращает кредиты обратно.
 *
 * Поле reserved — это часть уже списанного, которую ещё можно вернуть.
 * Поэтому доступно к трате ровно balance.
 */

interface WalletRow {
  balance: number
  reserved: number
  updated_at: string
}

export function ensureWallet(companyId: string): void {
  db()
    .prepare(
      `INSERT INTO credit_wallets (company_id, balance, reserved, updated_at)
       VALUES (?, 0, 0, ?) ON CONFLICT(company_id) DO NOTHING`,
    )
    .run(companyId, nowIso())
}

function walletRow(companyId: string): WalletRow {
  ensureWallet(companyId)
  return db()
    .prepare('SELECT balance, reserved, updated_at FROM credit_wallets WHERE company_id = ?')
    .get(companyId) as unknown as WalletRow
}

export function readWallet(companyId: string): Wallet {
  const row = walletRow(companyId)
  return {
    balance: row.balance,
    reserved: row.reserved,
    available: row.balance,
    updatedAt: row.updated_at,
  }
}

interface LedgerInput {
  companyId: string
  userId?: string | null
  projectId?: string | null
  jobId?: string | null
  type: UsageType
  creditDelta: number
  estimatedCostKopecks?: number
  actualCostKopecks?: number | null
  provider?: string | null
  model?: string | null
  status?: string
}

/** Единственное место, где меняется баланс. Всегда пишет строку журнала. */
function applyDelta(input: LedgerInput): { id: string; balanceAfter: number } {
  const row = walletRow(input.companyId)
  const before = row.balance
  const after = before + input.creditDelta
  if (after < 0) {
    throw conflict('Недостаточно AI-кредитов')
  }
  const now = nowIso()
  db()
    .prepare('UPDATE credit_wallets SET balance = ?, updated_at = ? WHERE company_id = ?')
    .run(after, now, input.companyId)

  const id = createId('utx')
  db()
    .prepare(
      `INSERT INTO usage_transactions
         (id, company_id, user_id, project_id, job_id, type, credit_delta,
          balance_before, balance_after, estimated_cost_kopecks, actual_cost_kopecks,
          provider, model, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.companyId,
      input.userId ?? null,
      input.projectId ?? null,
      input.jobId ?? null,
      input.type,
      input.creditDelta,
      before,
      after,
      input.estimatedCostKopecks ?? 0,
      input.actualCostKopecks ?? null,
      input.provider ?? null,
      input.model ?? null,
      input.status ?? 'completed',
      now,
    )
  return { id, balanceAfter: after }
}

/** Начисление: тариф, покупка пакета или ручная корректировка поддержкой. */
export function grantCredits(
  companyId: string,
  credits: number,
  type: UsageType = 'grant',
  userId?: string,
): Wallet {
  applyDelta({ companyId, userId, type, creditDelta: credits })
  return readWallet(companyId)
}

export interface ReserveInput {
  companyId: string
  userId: string
  projectId: string
  jobId: string
  credits: number
  estimatedCostKopecks: number
  provider: string
  model: string | null
}

/**
 * Резерв под задание. Вызывается внутри той же транзакции, что и создание
 * задания: иначе можно списать кредиты и не создать задание.
 */
export function reserveCredits(input: ReserveInput): string {
  const wallet = walletRow(input.companyId)
  if (wallet.balance < input.credits) {
    throw conflict('Недостаточно AI-кредитов')
  }
  const { id } = applyDelta({
    companyId: input.companyId,
    userId: input.userId,
    projectId: input.projectId,
    jobId: input.jobId,
    type: 'reserve',
    creditDelta: -input.credits,
    estimatedCostKopecks: input.estimatedCostKopecks,
    provider: input.provider,
    model: input.model,
    status: 'reserved',
  })
  db()
    .prepare('UPDATE credit_wallets SET reserved = reserved + ? WHERE company_id = ?')
    .run(input.credits, input.companyId)
  return id
}

/**
 * Задание удалось: резерв становится списанием.
 * Баланс уже уменьшен на этапе резерва — здесь только сверка фактической
 * стоимости у провайдера с оценкой.
 */
export function commitReservation(
  companyId: string,
  jobId: string,
  actualCostKopecks: number,
): void {
  const row = db()
    .prepare(
      `SELECT id, credit_delta AS creditDelta FROM usage_transactions
       WHERE job_id = ? AND company_id = ? AND type = 'reserve' AND status = 'reserved'`,
    )
    .get(jobId, companyId) as unknown as { id: string; creditDelta: number } | undefined
  if (!row) return

  db()
    .prepare(
      `UPDATE usage_transactions
         SET type = 'charge', status = 'completed', actual_cost_kopecks = ?
       WHERE id = ?`,
    )
    .run(actualCostKopecks, row.id)
  db()
    .prepare('UPDATE credit_wallets SET reserved = MAX(0, reserved + ?), updated_at = ? WHERE company_id = ?')
    .run(row.creditDelta, nowIso(), companyId)
}

/**
 * Задание не удалось: кредиты возвращаются.
 * Возврат идёт отдельной строкой журнала, чтобы движение было видно,
 * а не выглядело как будто списания не было.
 */
export function refundReservation(companyId: string, jobId: string, reason: string): number {
  const row = db()
    .prepare(
      `SELECT id, user_id AS userId, project_id AS projectId, credit_delta AS creditDelta,
              provider, model
       FROM usage_transactions
       WHERE job_id = ? AND company_id = ? AND type = 'reserve' AND status = 'reserved'`,
    )
    .get(jobId, companyId) as unknown as
    | { id: string; userId: string | null; projectId: string | null; creditDelta: number; provider: string | null; model: string | null }
    | undefined
  if (!row) return 0

  const credits = -row.creditDelta
  db().prepare("UPDATE usage_transactions SET status = 'refunded' WHERE id = ?").run(row.id)
  applyDelta({
    companyId,
    userId: row.userId,
    projectId: row.projectId,
    jobId,
    type: 'refund',
    creditDelta: credits,
    provider: row.provider,
    model: row.model,
    status: reason.slice(0, 200),
  })
  db()
    .prepare('UPDATE credit_wallets SET reserved = MAX(0, reserved - ?), updated_at = ? WHERE company_id = ?')
    .run(credits, nowIso(), companyId)
  return credits
}

export function listTransactions(companyId: string, limit = 50): UsageTransaction[] {
  const rows = db()
    .prepare(
      `SELECT id, type, credit_delta AS creditDelta, balance_before AS balanceBefore,
              balance_after AS balanceAfter, estimated_cost_kopecks AS estimatedCostKopecks,
              actual_cost_kopecks AS actualCostKopecks, provider, model,
              job_id AS jobId, project_id AS projectId, created_at AS createdAt
       FROM usage_transactions WHERE company_id = ?
       ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(companyId, limit) as unknown as UsageTransaction[]
  return rows
}
