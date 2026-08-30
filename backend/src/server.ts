import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import { applySchema, db } from './db/connection.ts'
import { env, validateEnv } from './env.ts'
import { badRequest } from './lib/errors.ts'
import { Router, applyCors, sendError, sendJson, type RequestContext } from './lib/http.ts'
import { authenticate, registerAuthRoutes } from './routes/auth.ts'
import { registerProjectRoutes } from './routes/projects.ts'
import { registerFileRoutes } from './routes/files.ts'
import { registerCatalogRoutes } from './routes/catalog.ts'
import { registerAiRoutes } from './routes/ai.ts'
import { registerGenerationRoutes } from './routes/generations.ts'
import { registerMeasurementRoutes } from './routes/measurements.ts'
import { ensurePlans } from './services/plans.ts'
import { recoverJobs, startWorker } from './services/jobs.ts'

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5190',
  'https://localhost:5173',
]

const router = new Router()

router.get('/api/v1/health', () => ({
  ok: true,
  time: new Date().toISOString(),
  aiEnabled: env.aiEnabled,
}))

registerAuthRoutes(router)
registerProjectRoutes(router)
registerFileRoutes(router)
registerCatalogRoutes(router)
registerAiRoutes(router)
registerGenerationRoutes(router)
registerMeasurementRoutes(router)

export function createApp() {
  return createServer(async (req, res) => {
    try {
      if (applyCors(req, res, ALLOWED_ORIGINS)) return

      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const route = router.match(req.method ?? 'GET', url.pathname)
      if (!route) {
        sendJson(res, 404, { error: 'not_found', message: 'Маршрут не найден' })
        return
      }

      const ctx: RequestContext = {
        req,
        res,
        params: route.params,
        query: url.searchParams,
        auth: authenticate(req.headers.authorization) ?? undefined,
      }

      const result = await route.handler(ctx)
      // Обработчик мог сам записать ответ — например, отдать файл потоком.
      if (res.headersSent) return
      sendJson(res, req.method === 'POST' ? 201 : 200, result ?? { ok: true })
    } catch (error) {
      if (res.headersSent) {
        res.end()
        return
      }
      if (error instanceof ZodError) {
        const first = error.issues[0]
        sendError(res, badRequest(`${first.path.join('.') || 'запрос'}: ${first.message}`))
        return
      }
      sendError(res, error)
    }
  })
}

if (import.meta.filename === process.argv[1]) {
  const warnings = validateEnv()
  mkdirSync(resolve(env.storageDir), { recursive: true })
  applySchema()
  // Разогреваем подключение, чтобы ошибки схемы всплыли при старте.
  db().prepare('SELECT 1').get()
  ensurePlans()
  // Задания, прерванные падением сервера, закрываем с возвратом кредитов:
  // доигрывать их нельзя, неизвестно, что успел сделать провайдер.
  const recovered = recoverJobs()
  startWorker()

  createApp().listen(env.port, () => {
    console.log('')
    console.log(`  Сервер ФОРМА запущен на http://localhost:${env.port}`)
    console.log(`  База: ${resolve(env.databaseFile)}`)
    console.log(`  Файлы: ${resolve(env.storageDir)}`)
    if (recovered > 0) console.log(`  Прерванных заданий закрыто: ${recovered}`)
    for (const warning of warnings) console.log(`  ⚠ ${warning}`)
    console.log('')
  })
}
