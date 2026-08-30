import * as z from 'zod'

/**
 * Кредиты, стоимость операций и задания генерации.
 *
 * Деньги здесь — целые копейки. Числа с плавающей точкой в деньгах
 * накапливают ошибку округления, поэтому рублей в типах нет вообще.
 * Кредиты тоже целые: половины кредита не бывает.
 */

export const JOB_STATUSES = [
  'queued',
  'preparing',
  'generating',
  'validating',
  'saving',
  'completed',
  'failed',
] as const
export const jobStatusSchema = z.enum(JOB_STATUSES)
export type JobStatus = (typeof JOB_STATUSES)[number]

/** Статус, после которого задание больше не меняется. */
export function isTerminalStatus(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed'
}

/** Человеческие подписи стадий: фронтенд не выдумывает свои. */
export const JOB_STAGE_LABELS: Record<JobStatus, string> = {
  queued: 'В очереди',
  preparing: 'Готовим сцену',
  generating: 'Считаем изображение',
  validating: 'Проверяем результат',
  saving: 'Сохраняем варианты',
  completed: 'Готово',
  failed: 'Не удалось',
}

export const GENERATION_QUALITIES = ['preview', 'refine', 'final'] as const
export const generationQualitySchema = z.enum(GENERATION_QUALITIES)
export type GenerationQuality = (typeof GENERATION_QUALITIES)[number]

export const GENERATION_QUALITY_LABELS: Record<GenerationQuality, string> = {
  preview: 'Черновой просмотр',
  refine: 'Уточнение',
  final: 'Финальное качество',
}

/**
 * Стоимость операций в кредитах.
 * Значения хранятся в базе и меняются администратором без пересборки.
 */
export const creditCostsSchema = z.object({
  preview: z.int().min(0).default(1),
  refine: z.int().min(0).default(1),
  final: z.int().min(0).default(2),
  analyze: z.int().min(0).default(1),
})
export type CreditCosts = z.infer<typeof creditCostsSchema>

export function defaultCreditCosts(): CreditCosts {
  return creditCostsSchema.parse({})
}

/**
 * Жёсткие лимиты на стороне сервера.
 * Ни один из них нельзя переопределить из браузера: клиент про них только читает.
 */
export const budgetLimitsSchema = z.object({
  /** Потолок расходов на провайдера за месяц, копейки. */
  perUserMonthlyKopecks: z.int().min(0).default(300_000),
  perCompanyMonthlyKopecks: z.int().min(0).default(1_500_000),
  globalDailyKopecks: z.int().min(0).default(2_000_000),
  globalMonthlyKopecks: z.int().min(0).default(30_000_000),
  /** Сколько изображений разрешено просить в одном задании. */
  maxVariantsPerJob: z.int().min(1).max(8).default(4),
  /** Сколько заданий компании считаются одновременно. */
  maxConcurrentJobsPerCompany: z.int().min(1).max(10).default(2),
  /** Ограничение частоты запусков: сколько заданий в минуту на компанию. */
  maxJobsPerMinutePerCompany: z.int().min(1).default(6),
})
export type BudgetLimits = z.infer<typeof budgetLimitsSchema>

export function defaultBudgetLimits(): BudgetLimits {
  return budgetLimitsSchema.parse({})
}

export const walletSchema = z.object({
  balance: z.int(),
  reserved: z.int(),
  /** Сколько доступно прямо сейчас: резерв уже вычтен. */
  available: z.int(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const USAGE_TYPES = [
  'grant',
  'reserve',
  'charge',
  'refund',
  'purchase',
  'adjustment',
] as const
export const usageTypeSchema = z.enum(USAGE_TYPES)
export type UsageType = (typeof USAGE_TYPES)[number]

export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  grant: 'Начисление по тарифу',
  reserve: 'Резерв под генерацию',
  charge: 'Списание за генерацию',
  refund: 'Возврат кредитов',
  purchase: 'Покупка пакета',
  adjustment: 'Ручная корректировка',
}

export const usageTransactionSchema = z.object({
  id: z.string(),
  type: usageTypeSchema,
  creditDelta: z.int(),
  balanceBefore: z.int(),
  balanceAfter: z.int(),
  estimatedCostKopecks: z.int(),
  actualCostKopecks: z.int().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  jobId: z.string().nullable(),
  projectId: z.string().nullable(),
  createdAt: z.string(),
})
export type UsageTransaction = z.infer<typeof usageTransactionSchema>

export const generationJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  revisionId: z.string(),
  status: jobStatusSchema,
  stage: z.string().nullable(),
  variants: z.int(),
  quality: generationQualitySchema,
  provider: z.string(),
  model: z.string().nullable(),
  creditsReserved: z.int(),
  attempts: z.int(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  options: z
    .array(
      z.object({
        id: z.string(),
        index: z.int(),
        fileId: z.string().nullable(),
        url: z.string().nullable(),
        selected: z.boolean(),
      }),
    )
    .default([]),
})
export type GenerationJob = z.infer<typeof generationJobSchema>

/** Доля выполнения по стадии. Прогресс не выдумывается на клиенте. */
export const JOB_PROGRESS: Record<JobStatus, number> = {
  queued: 0.02,
  preparing: 0.15,
  generating: 0.55,
  validating: 0.8,
  saving: 0.92,
  completed: 1,
  failed: 1,
}
