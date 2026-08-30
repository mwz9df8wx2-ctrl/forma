import * as z from 'zod'
import { db } from '../db/connection.ts'
import { env } from '../env.ts'
import { badRequest, notFound, unavailable } from '../lib/errors.ts'
import { readJson, type Router } from '../lib/http.ts'
import { requireAuth } from './auth.ts'
import { writeAudit } from '../lib/audit.ts'

/**
 * Обращения к внешним моделям.
 *
 * Ключи провайдеров живут только здесь. Фронтенд их не видит и не может
 * увидеть: он присылает идентификаторы и параметры, сервер подставляет ключ.
 * Глобальный выключатель AI_GENERATION_ENABLED останавливает новые обращения,
 * не ломая остальную работу приложения.
 */

const generateSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(10).max(4000),
  fileId: z.string().nullish(),
  variants: z.int().min(1).max(4).default(2),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1536x1024'),
})

const analyzeSchema = z.object({
  projectId: z.string(),
  fileId: z.string(),
  instruction: z.string().max(4000),
  schema: z.unknown().optional(),
})

function assertAiAvailable(): void {
  if (!env.aiEnabled) {
    throw unavailable('Генерация временно отключена. Проекты, расчёты и чертежи работают.')
  }
}

function assertProject(projectId: string, companyId: string): void {
  const row = db()
    .prepare('SELECT id FROM projects WHERE id = ? AND company_id = ?')
    .get(projectId, companyId)
  if (!row) throw notFound('Проект не найден')
}

export function registerAiRoutes(router: Router): void {
  /** Состояние возможностей: фронтенд рисует интерфейс по этому ответу. */
  router.get('/api/v1/ai/capabilities', (ctx) => {
    requireAuth(ctx)
    return {
      generationEnabled: env.aiEnabled && env.openAiKey !== '',
      analysisEnabled: env.aiEnabled && env.anthropicKey !== '',
      // Ключи наружу не отдаются — только факт их наличия.
      reason: env.aiEnabled ? null : 'Генерация отключена администратором',
    }
  })

  router.post('/api/v1/ai/generate', async (ctx) => {
    const auth = requireAuth(ctx)
    const input = generateSchema.parse(await readJson(ctx.req))
    assertAiAvailable()
    assertProject(input.projectId, auth.companyId)
    if (!env.openAiKey) throw unavailable('Провайдер генерации не настроен на сервере')

    // Учёт кредитов и постановка в очередь появятся на этапе M3.
    // Сейчас важно, что ключ уже никогда не покидает сервер.
    writeAudit(auth, 'ai.generate.requested', input.projectId, {
      variants: input.variants,
      size: input.size,
    })
    throw unavailable(
      'Очередь генерации ещё не подключена. Ключ провайдера уже на сервере, запуск включается на этапе кредитов.',
    )
  })

  router.post('/api/v1/ai/analyze', async (ctx) => {
    const auth = requireAuth(ctx)
    const input = analyzeSchema.parse(await readJson(ctx.req))
    assertAiAvailable()
    assertProject(input.projectId, auth.companyId)
    if (!env.anthropicKey) throw unavailable('Разбор снимков не настроен на сервере')

    const file = db()
      .prepare('SELECT object_key AS objectKey, mime FROM project_files WHERE id = ? AND company_id = ?')
      .get(input.fileId, auth.companyId) as unknown as { objectKey: string; mime: string } | undefined
    if (!file) throw notFound('Файл не найден')
    if (!file.mime.startsWith('image/')) throw badRequest('Разбирать можно только изображение')

    writeAudit(auth, 'ai.analyze.requested', input.projectId, { fileId: input.fileId })
    throw unavailable('Разбор через сервер подключается вместе с очередью на этапе M3.')
  })
}
