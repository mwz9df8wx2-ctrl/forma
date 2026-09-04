import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { db, transaction } from '../db/connection.ts'
import { env } from '../env.ts'
import { badRequest, notFound, paymentRequired, unavailable } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { storeFile } from '../lib/storage.ts'
import { imageProvider, type ImageRequest } from '../providers/images.ts'
import { commitReservation, readWallet, refundReservation, reserveCredits } from './credits.ts'
import { assertConcurrency, assertRateLimit, assertWithinBudgets } from './limits.ts'
import { buildImagePrompt, MAX_NOTES_LENGTH } from './prompt.ts'
import { budgetLimits, jobCost } from './settings.ts'
import {
  JOB_PROGRESS,
  JOB_STAGE_LABELS,
  projectSpecSchema,
  specReadiness,
  type GenerationJob,
  type GenerationQuality,
  type JobStatus,
} from '../../../shared/src/index.ts'

/**
 * Очередь заданий на генерацию.
 *
 * Генерация длится десятки секунд и стоит денег. Держать её в одном HTTP-
 * запросе нельзя: браузер оборвёт соединение, пользователь нажмёт кнопку
 * ещё раз, и компания заплатит дважды. Поэтому запрос только ставит задание
 * в очередь, а результат забирается по идентификатору.
 *
 * Порядок операций при запуске жёсткий и менять его нельзя:
 *   проверка проекта → кредиты → бюджеты → резерв → создание задания
 *   → обращение к провайдеру → сверка фактической стоимости.
 * Резерв и создание задания идут в одной транзакции: иначе бывает списание
 * без задания или задание без списания.
 */

const MAX_ATTEMPTS = 2

interface JobRow {
  id: string
  companyId: string
  projectId: string
  revisionId: string
  createdBy: string
  status: JobStatus
  stage: string | null
  variants: number
  quality: GenerationQuality
  size: ImageRequest['size']
  seed: number
  notes: string
  referenceFileId: string | null
  maskFileId: string | null
  provider: string
  model: string | null
  creditsReserved: number
  estimatedCostKopecks: number
  actualCostKopecks: number | null
  attempts: number
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

const JOB_COLUMNS = `
  id, company_id AS companyId, project_id AS projectId, revision_id AS revisionId,
  created_by AS createdBy, status, stage, variants, quality, size, seed, notes,
  reference_file_id AS referenceFileId, mask_file_id AS maskFileId, provider, model,
  credits_reserved AS creditsReserved, estimated_cost_kopecks AS estimatedCostKopecks,
  actual_cost_kopecks AS actualCostKopecks, attempts, error_code AS errorCode,
  error_message AS errorMessage, created_at AS createdAt, started_at AS startedAt,
  finished_at AS finishedAt`

// --- оповещение подписчиков -------------------------------------------------

export interface JobEvent {
  jobId: string
  status: JobStatus
  stage: string | null
  progress: number
  errorMessage?: string | null
  creditsRefunded?: number
}

type Listener = (event: JobEvent) => void
const listeners = new Map<string, Set<Listener>>()

/** Подписка для SSE. Возвращает функцию отписки — её обязан вызвать вызвавший. */
export function subscribeJob(jobId: string, listener: Listener): () => void {
  const set = listeners.get(jobId) ?? new Set<Listener>()
  set.add(listener)
  listeners.set(jobId, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(jobId)
  }
}

function emit(event: JobEvent): void {
  for (const listener of listeners.get(event.jobId) ?? []) {
    try {
      listener(event)
    } catch {
      /* сорвавшийся подписчик не должен ронять задание */
    }
  }
}

// --- чтение -----------------------------------------------------------------

function loadRow(jobId: string): JobRow | undefined {
  return db()
    .prepare(`SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE id = ?`)
    .get(jobId) as unknown as JobRow | undefined
}

function toJob(row: JobRow): GenerationJob {
  const options = db()
    .prepare(
      `SELECT id, option_index AS optionIndex, file_id AS fileId, selected
         FROM visualization_options WHERE job_id = ? ORDER BY option_index`,
    )
    .all(row.id) as unknown as { id: string; optionIndex: number; fileId: string | null; selected: number }[]

  return {
    id: row.id,
    projectId: row.projectId,
    revisionId: row.revisionId,
    status: row.status,
    stage: row.stage,
    variants: row.variants,
    quality: row.quality,
    provider: row.provider,
    model: row.model,
    creditsReserved: row.creditsReserved,
    attempts: row.attempts,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    options: options.map((option) => ({
      id: option.id,
      index: option.optionIndex,
      fileId: option.fileId,
      url: option.fileId ? `/api/v1/files/${option.fileId}` : null,
      selected: option.selected === 1,
    })),
  }
}

export function readJob(companyId: string, jobId: string): GenerationJob {
  const row = loadRow(jobId)
  // Чужое задание не существует: по коду ответа нельзя узнать, что оно есть.
  if (!row || row.companyId !== companyId) throw notFound('Задание не найдено')
  return toJob(row)
}

export function listJobs(companyId: string, projectId?: string): GenerationJob[] {
  const rows = projectId
    ? (db()
        .prepare(
          `SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE company_id = ? AND project_id = ?
             ORDER BY created_at DESC LIMIT 50`,
        )
        .all(companyId, projectId) as unknown as JobRow[])
    : (db()
        .prepare(
          `SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE company_id = ?
             ORDER BY created_at DESC LIMIT 50`,
        )
        .all(companyId) as unknown as JobRow[])
  return rows.map(toJob)
}

// --- постановка в очередь ---------------------------------------------------

export interface EnqueueInput {
  companyId: string
  userId: string
  projectId: string
  quality: GenerationQuality
  variants: number
  size: ImageRequest['size']
  seed: number
  notes: string
  referenceFileId: string | null
  maskFileId: string | null
  idempotencyKey: string | null
}

function setStatus(
  jobId: string,
  status: JobStatus,
  extra?: { errorCode?: string; errorMessage?: string; creditsRefunded?: number },
): void {
  const now = nowIso()
  const stage = JOB_STAGE_LABELS[status]
  db()
    .prepare(
      `UPDATE generation_jobs
          SET status = ?, stage = ?,
              started_at = COALESCE(started_at, CASE WHEN ? = 'preparing' THEN ? ELSE NULL END),
              finished_at = CASE WHEN ? IN ('completed', 'failed') THEN ? ELSE finished_at END,
              error_code = COALESCE(?, error_code),
              error_message = COALESCE(?, error_message)
        WHERE id = ?`,
    )
    .run(status, stage, status, now, status, now, extra?.errorCode ?? null, extra?.errorMessage ?? null, jobId)

  emit({
    jobId,
    status,
    stage,
    progress: JOB_PROGRESS[status],
    errorMessage: extra?.errorMessage ?? null,
    creditsRefunded: extra?.creditsRefunded,
  })
}

function setProjectStatus(projectId: string, status: string): void {
  db()
    .prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, nowIso(), projectId)
}

export function enqueueGeneration(input: EnqueueInput): { job: GenerationJob; reused: boolean } {
  if (!env.aiEnabled) {
    // Общий выключатель: останавливает новые обращения, не ломая остальное.
    throw unavailable('Генерация временно отключена. Проекты, расчёты и чертежи работают.')
  }

  const limits = budgetLimits()
  if (input.variants > limits.maxVariantsPerJob) {
    throw badRequest(`За один раз можно запросить не больше ${limits.maxVariantsPerJob} вариантов`)
  }
  if (input.notes.length > MAX_NOTES_LENGTH) {
    throw badRequest(`Пожелания длиннее ${MAX_NOTES_LENGTH} символов не передаются`)
  }

  const provider = imageProvider()

  const result = transaction(() => {
    // Повтор с тем же ключом отдаёт то же задание. Двойное нажатие кнопки
    // и повтор запроса браузером не должны стоить вторых денег.
    if (input.idempotencyKey) {
      const existing = db()
        .prepare(
          `SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE company_id = ? AND idempotency_key = ?`,
        )
        .get(input.companyId, input.idempotencyKey) as unknown as JobRow | undefined
      if (existing) return { job: toJob(existing), reused: true }
    }

    const project = db()
      .prepare(
        `SELECT id, current_revision_id AS revisionId FROM projects
          WHERE id = ? AND company_id = ?`,
      )
      .get(input.projectId, input.companyId) as unknown as
      | { id: string; revisionId: string | null }
      | undefined
    if (!project) throw notFound('Проект не найден')
    if (!project.revisionId) throw badRequest('У проекта нет сохранённой спецификации')

    const revision = db()
      .prepare('SELECT spec_snapshot AS spec FROM project_revisions WHERE id = ?')
      .get(project.revisionId) as unknown as { spec: string } | undefined
    if (!revision) throw badRequest('Ревизия проекта не найдена')

    // Картинка не должна опережать замеры: генерировать по недостающим
    // размерам — значит показать клиенту то, что нельзя изготовить.
    const spec = projectSpecSchema.parse(JSON.parse(revision.spec))
    const readiness = specReadiness(spec)
    if (!readiness.ready) {
      throw badRequest(`Не хватает размеров: ${readiness.missing.join(', ')}`)
    }

    for (const fileId of [input.referenceFileId, input.maskFileId]) {
      if (!fileId) continue
      const file = db()
        .prepare('SELECT id FROM project_files WHERE id = ? AND company_id = ?')
        .get(fileId, input.companyId)
      if (!file) throw notFound('Файл-образец не найден')
    }
    // Маска без снимка бессмысленна: перерисовывать нечего.
    if (input.maskFileId && !input.referenceFileId) {
      throw badRequest('Маска замены передана без снимка помещения')
    }

    assertRateLimit(input.companyId)
    assertConcurrency(input.companyId)

    const credits = jobCost(input.quality, input.variants)
    const estimated = provider.estimateKopecks({
      prompt: '',
      variants: input.variants,
      quality: input.quality,
      size: input.size,
      seed: input.seed,
    })
    assertWithinBudgets(input.companyId, input.userId, estimated)

    // Нехватка кредитов — это вопрос оплаты, а не конфликт состояния:
    // отдельный код ответа позволяет фронтенду показать нужный экран.
    if (readWallet(input.companyId).available < credits) {
      throw paymentRequired(
        'AI-кредиты закончились. Проекты, расчёты и чертежи продолжают работать.',
      )
    }

    const jobId = createId('job')
    reserveCredits({
      companyId: input.companyId,
      userId: input.userId,
      projectId: input.projectId,
      jobId,
      credits,
      estimatedCostKopecks: estimated,
      provider: provider.name,
      model: provider.model,
    })

    const now = nowIso()
    db()
      .prepare(
        `INSERT INTO generation_jobs
           (id, company_id, project_id, revision_id, created_by, status, stage,
            variants, quality, size, seed, notes, reference_file_id, mask_file_id,
            provider, model, credits_reserved, estimated_cost_kopecks, attempts,
            idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        jobId,
        input.companyId,
        input.projectId,
        project.revisionId,
        input.userId,
        JOB_STAGE_LABELS.queued,
        input.variants,
        input.quality,
        input.size,
        input.seed,
        input.notes,
        input.referenceFileId,
        input.maskFileId,
        provider.name,
        provider.model,
        credits,
        estimated,
        input.idempotencyKey,
        now,
      )

    setProjectStatus(input.projectId, 'visualization_queued')
    return { job: toJob(loadRow(jobId)!), reused: false }
  })

  if (!result.reused) pump()
  return result
}

// --- исполнение -------------------------------------------------------------

let running = 0
let timer: NodeJS.Timeout | null = null

function nextQueued(): JobRow | undefined {
  const limits = budgetLimits()
  return db()
    .prepare(
      `SELECT ${JOB_COLUMNS} FROM generation_jobs j
        WHERE status = 'queued'
          AND (SELECT COUNT(*) FROM generation_jobs r
                WHERE r.company_id = j.company_id
                  AND r.status NOT IN ('queued', 'completed', 'failed')) < ?
        ORDER BY created_at LIMIT 1`,
    )
    .get(limits.maxConcurrentJobsPerCompany) as unknown as JobRow | undefined
}

/** Берёт из очереди столько заданий, сколько разрешено считать одновременно. */
export function pump(): void {
  const limits = budgetLimits()
  while (running < limits.maxConcurrentJobsPerCompany * 2) {
    const row = nextQueued()
    if (!row) return
    running += 1
    setStatus(row.id, 'preparing')
    void runJob(row.id).finally(() => {
      running -= 1
      // Освободилось место — возможно, кто-то ждёт в очереди.
      queueMicrotask(pump)
    })
  }
}

async function readReference(fileId: string | null): Promise<{ data: Buffer; mime: string } | null> {
  if (!fileId) return null
  const row = db()
    .prepare('SELECT object_key AS objectKey, mime FROM project_files WHERE id = ?')
    .get(fileId) as unknown as { objectKey: string; mime: string } | undefined
  if (!row) return null
  try {
    return { data: await readFile(resolve(env.storageDir, row.objectKey)), mime: row.mime }
  } catch {
    // Отсутствующий образец не повод терять задание: считаем без него.
    return null
  }
}

async function runJob(jobId: string): Promise<void> {
  const row = loadRow(jobId)
  if (!row) return
  const provider = imageProvider()

  try {
    const revision = db()
      .prepare('SELECT spec_snapshot AS spec FROM project_revisions WHERE id = ?')
      .get(row.revisionId) as unknown as { spec: string }
    const spec = projectSpecSchema.parse(JSON.parse(revision.spec))
    const prompt = buildImagePrompt({ spec, notes: row.notes })
    const reference = await readReference(row.referenceFileId)
    // Маску отправляем только вместе со снимком: без него она ничего не значит.
    const mask = reference ? await readReference(row.maskFileId) : null

    setProjectStatus(row.projectId, 'visualization_running')
    setStatus(jobId, 'generating')

    const request: ImageRequest = {
      prompt,
      variants: row.variants,
      quality: row.quality,
      size: row.size,
      seed: row.seed,
      reference,
      mask,
    }

    let attempt = 0
    let lastError: unknown = null
    let result = null as Awaited<ReturnType<typeof provider.generate>> | null
    while (attempt < MAX_ATTEMPTS) {
      attempt += 1
      db().prepare('UPDATE generation_jobs SET attempts = ? WHERE id = ?').run(attempt, jobId)
      try {
        result = await provider.generate(request)
        break
      } catch (error) {
        lastError = error
        // Повтор внутри задания не резервирует кредиты заново — платит
        // компания один раз за задание, а не за каждую попытку.
        if (!provider.isTransient(error) || attempt >= MAX_ATTEMPTS) throw error
      }
    }
    if (!result) throw lastError ?? new Error('Провайдер не вернул результат')

    setStatus(jobId, 'validating')
    const good = result.images.filter((image) => image.data.length > 0)
    if (good.length === 0) throw new Error('Провайдер вернул пустые изображения')

    setStatus(jobId, 'saving')
    let index = 0
    for (const image of good) {
      const file = await storeFile({
        companyId: row.companyId,
        projectId: row.projectId,
        uploadedBy: row.createdBy,
        kind: 'visualization',
        data: image.data,
      })
      db()
        .prepare(
          `INSERT INTO visualization_options
             (id, company_id, project_id, revision_id, job_id, option_index, file_id,
              provider, model, prompt_version, params, selected, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'v2', ?, 0, ?)`,
        )
        .run(
          createId('vis'),
          row.companyId,
          row.projectId,
          row.revisionId,
          jobId,
          index,
          file.id,
          provider.name,
          result.model,
          JSON.stringify({ quality: row.quality, size: row.size, seed: row.seed }),
          nowIso(),
        )
      index += 1
    }

    // Сверка: оценка резервировала бюджет, факт закрывает операцию.
    transaction(() => {
      db()
        .prepare('UPDATE generation_jobs SET actual_cost_kopecks = ?, model = ? WHERE id = ?')
        .run(result.actualCostKopecks, result.model, jobId)
      commitReservation(row.companyId, jobId, result.actualCostKopecks)
    })

    setProjectStatus(row.projectId, 'visualization_ready')
    setStatus(jobId, 'completed')
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : 'Не удалось создать визуализацию'
    const refunded = transaction(() =>
      refundReservation(row.companyId, jobId, `сбой задания: ${message}`),
    )
    setProjectStatus(row.projectId, 'ready_for_visualization')
    setStatus(jobId, 'failed', {
      errorCode: 'provider_failed',
      errorMessage: message.slice(0, 500),
      creditsRefunded: refunded,
    })
  }
}

/**
 * Восстановление после перезапуска.
 * Задание, которое считалось в момент падения, доигрывать нельзя: неизвестно,
 * что успел сделать провайдер. Возвращаем кредиты и сообщаем честно.
 */
export function recoverJobs(): number {
  const stuck = db()
    .prepare(
      `SELECT id, company_id AS companyId, project_id AS projectId FROM generation_jobs
        WHERE status NOT IN ('queued', 'completed', 'failed')`,
    )
    .all() as unknown as { id: string; companyId: string; projectId: string }[]

  for (const job of stuck) {
    const refunded = transaction(() =>
      refundReservation(job.companyId, job.id, 'перезапуск сервера во время расчёта'),
    )
    setProjectStatus(job.projectId, 'ready_for_visualization')
    setStatus(job.id, 'failed', {
      errorCode: 'interrupted',
      errorMessage: 'Расчёт прервал перезапуск сервера. AI-кредиты возвращены.',
      creditsRefunded: refunded,
    })
  }
  return stuck.length
}

/** Фоновая проверка очереди: страховка на случай, если pump никто не позвал. */
export function startWorker(intervalMs = 2000): void {
  if (timer) return
  timer = setInterval(pump, intervalMs)
  timer.unref?.()
  pump()
}

export function stopWorker(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** Ожидание завершения задания. Используется тестами и SSE-переподключением. */
export function whenSettled(jobId: string, timeoutMs = 15000): Promise<GenerationJob | null> {
  return new Promise((resolveJob) => {
    const row = loadRow(jobId)
    if (row && (row.status === 'completed' || row.status === 'failed')) {
      resolveJob(toJob(row))
      return
    }
    const timeout = setTimeout(() => {
      unsubscribe()
      resolveJob(null)
    }, timeoutMs)
    const unsubscribe = subscribeJob(jobId, (event) => {
      if (event.status !== 'completed' && event.status !== 'failed') return
      clearTimeout(timeout)
      unsubscribe()
      const settled = loadRow(jobId)
      resolveJob(settled ? toJob(settled) : null)
    })
  })
}
