import * as z from 'zod'
import { db } from '../db/connection.ts'
import { notFound } from '../lib/errors.ts'
import { readJson, type Router } from '../lib/http.ts'
import { writeAudit } from '../lib/audit.ts'
import { nowIso } from '../lib/ids.ts'
import { listTransactions, readWallet } from '../services/credits.ts'
import { budgetLimits, creditCosts, jobCost } from '../services/settings.ts'
import { budgetUsage } from '../services/limits.ts'
import {
  enqueueGeneration,
  listJobs,
  readJob,
  subscribeJob,
  whenSettled,
} from '../services/jobs.ts'
import {
  generationQualitySchema,
  JOB_PROGRESS,
  JOB_STAGE_LABELS,
  isTerminalStatus,
} from '../../../shared/src/index.ts'
import { requireAuth } from './auth.ts'

/**
 * Запуск визуализации и наблюдение за ней.
 *
 * Клиент не ждёт результат в одном запросе: он ставит задание и подписывается
 * на события. Прогресс приходит по реальным стадиям — выдуманных процентов,
 * которые ползут вверх при мёртвом задании, здесь нет.
 */

const enqueueSchema = z.object({
  quality: generationQualitySchema.default('preview'),
  variants: z.int().min(1).max(8).default(3),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1536x1024'),
  seed: z.int().min(0).max(2_147_483_647).default(0),
  /** Свободные пожелания клиента. Полный текст подсказки собирает сервер. */
  notes: z.string().max(400).default(''),
  referenceFileId: z.string().nullish(),
})

export function registerGenerationRoutes(router: Router): void {
  /** Кошелёк, цены и лимиты: фронтенд рисует остаток и стоимость запуска. */
  router.get('/api/v1/billing/wallet', (ctx) => {
    const auth = requireAuth(ctx)
    const limits = budgetLimits()
    return {
      wallet: readWallet(auth.companyId),
      costs: creditCosts(),
      limits: {
        maxVariantsPerJob: limits.maxVariantsPerJob,
        maxConcurrentJobsPerCompany: limits.maxConcurrentJobsPerCompany,
      },
      usage: budgetUsage(auth.companyId, auth.userId),
    }
  })

  router.get('/api/v1/billing/transactions', (ctx) => {
    const auth = requireAuth(ctx)
    return { transactions: listTransactions(auth.companyId) }
  })

  router.post('/api/v1/projects/:id/generations', async (ctx) => {
    const auth = requireAuth(ctx)
    const input = enqueueSchema.parse(await readJson(ctx.req))
    const header = ctx.req.headers['idempotency-key']
    const idempotencyKey = typeof header === 'string' && header.length <= 200 ? header : null

    const { job, reused } = enqueueGeneration({
      companyId: auth.companyId,
      userId: auth.userId,
      projectId: ctx.params.id,
      quality: input.quality,
      variants: input.variants,
      size: input.size,
      // Нулевое зерно означает «выбери сам»: одинаковые запуски не должны
      // молча возвращать одну и ту же картинку.
      seed: input.seed === 0 ? Math.floor(Math.random() * 2_147_483_646) + 1 : input.seed,
      notes: input.notes,
      referenceFileId: input.referenceFileId ?? null,
      idempotencyKey,
    })

    if (!reused) {
      writeAudit(auth, 'generation.enqueued', ctx.params.id, {
        jobId: job.id,
        quality: job.quality,
        variants: job.variants,
        credits: job.creditsReserved,
      })
    }

    return {
      job,
      reused,
      wallet: readWallet(auth.companyId),
      cost: jobCost(input.quality, input.variants),
    }
  })

  router.get('/api/v1/projects/:id/generations', (ctx) => {
    const auth = requireAuth(ctx)
    const project = db()
      .prepare('SELECT id FROM projects WHERE id = ? AND company_id = ?')
      .get(ctx.params.id, auth.companyId)
    if (!project) throw notFound('Проект не найден')
    return { jobs: listJobs(auth.companyId, ctx.params.id) }
  })

  router.get('/api/v1/generations/:id', (ctx) => {
    const auth = requireAuth(ctx)
    const job = readJob(auth.companyId, ctx.params.id)
    return { job, progress: JOB_PROGRESS[job.status], wallet: readWallet(auth.companyId) }
  })

  /** Выбор варианта клиентом: он попадёт в техпакет. */
  router.post('/api/v1/generations/:id/select', async (ctx) => {
    const auth = requireAuth(ctx)
    const body = (await readJson(ctx.req)) as { optionId?: string }
    const job = readJob(auth.companyId, ctx.params.id)
    const option = job.options.find((item) => item.id === body.optionId)
    if (!option) throw notFound('Вариант не найден')

    db().prepare('UPDATE visualization_options SET selected = 0 WHERE job_id = ?').run(job.id)
    db().prepare('UPDATE visualization_options SET selected = 1 WHERE id = ?').run(option.id)
    db()
      .prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
      .run(nowIso(), job.projectId)
    writeAudit(auth, 'generation.option.selected', job.projectId, { jobId: job.id, optionId: option.id })
    return { job: readJob(auth.companyId, job.id) }
  })

  /**
   * Поток событий задания.
   * Держим одно соединение вместо опроса раз в секунду: так видно каждую
   * стадию сразу, а сервер не отвечает на пустые запросы.
   */
  router.get('/api/v1/generations/:id/events', (ctx) => {
    const auth = requireAuth(ctx)
    const job = readJob(auth.companyId, ctx.params.id)

    ctx.res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (payload: unknown) => {
      ctx.res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    send({
      jobId: job.id,
      status: job.status,
      stage: job.stage ?? JOB_STAGE_LABELS[job.status],
      progress: JOB_PROGRESS[job.status],
      options: job.options,
    })

    if (isTerminalStatus(job.status)) {
      ctx.res.end()
      return undefined
    }

    const unsubscribe = subscribeJob(job.id, (event) => {
      const fresh = isTerminalStatus(event.status) ? readJob(auth.companyId, job.id) : null
      send({ ...event, options: fresh?.options ?? [] })
      if (isTerminalStatus(event.status)) {
        unsubscribe()
        clearInterval(heartbeat)
        ctx.res.end()
      }
    })

    // Прокси-серверы рвут молчащее соединение — поддерживаем его живым.
    const heartbeat = setInterval(() => ctx.res.write(': ping\n\n'), 15000)
    heartbeat.unref?.()

    ctx.req.on('close', () => {
      unsubscribe()
      clearInterval(heartbeat)
    })

    return undefined
  })

  /**
   * Ожидание результата одним запросом — для мобильного клиента,
   * которому поток событий держать дороже, чем один долгий запрос.
   */
  router.get('/api/v1/generations/:id/result', async (ctx) => {
    const auth = requireAuth(ctx)
    readJob(auth.companyId, ctx.params.id)
    const settled = await whenSettled(ctx.params.id, 60_000)
    return { job: settled ?? readJob(auth.companyId, ctx.params.id) }
  })
}
