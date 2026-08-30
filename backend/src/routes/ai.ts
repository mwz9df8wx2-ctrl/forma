import * as z from 'zod'
import { db } from '../db/connection.ts'
import { env } from '../env.ts'
import { badRequest, notFound, unavailable } from '../lib/errors.ts'
import { readJson, type Router } from '../lib/http.ts'
import { imageProvider } from '../providers/images.ts'
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
    const provider = imageProvider()
    return {
      generationEnabled: env.aiEnabled,
      analysisEnabled: env.aiEnabled && env.anthropicKey !== '',
      // Ключи наружу не отдаются — только имя провайдера и факт настройки.
      provider: provider.name,
      model: provider.model,
      // Без ключа работает тестовый провайдер: интерфейс проверяем, деньги нет.
      demo: provider.name === 'mock',
      reason: env.aiEnabled ? null : 'Генерация отключена администратором',
    }
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
    throw unavailable('Разбор снимка через сервер подключается вместе с диалогом уточнений.')
  })
}
