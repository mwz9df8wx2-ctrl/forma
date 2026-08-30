import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import { db } from '../db/connection.ts'
import { env } from '../env.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { readBody, type Router } from '../lib/http.ts'
import { storeFile } from '../lib/storage.ts'
import { requireAuth } from './auth.ts'
import { writeAudit } from '../lib/audit.ts'

/**
 * Файлы проекта.
 *
 * На снимках помещения бывают личные вещи клиента, поэтому публичных ссылок
 * нет: файл отдаётся только по запросу авторизованного пользователя той же
 * компании. Содержимое лежит на диске, в базе — только метаданные.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024

const FILE_KINDS = new Set([
  'room_photo',
  'sketch',
  'detail_photo',
  'reference',
  'catalog_sample',
  'visualization',
  'technical_pdf',
])

export function registerFileRoutes(router: Router): void {
  router.post('/api/v1/projects/:id/files', async (ctx) => {
    const auth = requireAuth(ctx)
    const project = db()
      .prepare('SELECT id FROM projects WHERE id = ? AND company_id = ?')
      .get(ctx.params.id, auth.companyId) as unknown as { id: string } | undefined
    if (!project) throw notFound('Проект не найден')

    const kind = String(ctx.req.headers['x-file-kind'] ?? 'room_photo')
    if (!FILE_KINDS.has(kind)) throw badRequest('Неизвестный тип файла')

    const body = await readBody(ctx.req, MAX_FILE_BYTES)
    const file = await storeFile({
      companyId: auth.companyId,
      projectId: project.id,
      uploadedBy: auth.userId,
      kind,
      data: body,
    })

    writeAudit(auth, 'file.uploaded', project.id, { fileId: file.id, kind, size: file.sizeBytes })
    return {
      file: { id: file.id, kind, mime: file.mime, sizeBytes: file.sizeBytes, url: `/api/v1/files/${file.id}` },
    }
  })

  router.get('/api/v1/projects/:id/files', (ctx) => {
    const auth = requireAuth(ctx)
    const rows = db()
      .prepare(
        `SELECT id, kind, mime, size_bytes AS sizeBytes, created_at AS createdAt
           FROM project_files WHERE project_id = ? AND company_id = ?
          ORDER BY created_at DESC`,
      )
      .all(ctx.params.id, auth.companyId)
    return { files: rows }
  })

  /** Отдача файла. Чужой файл не отдаётся даже по прямой ссылке. */
  router.get('/api/v1/files/:id', (ctx) => {
    const auth = requireAuth(ctx)
    const row = db()
      .prepare(
        `SELECT object_key AS objectKey, mime, size_bytes AS sizeBytes
           FROM project_files WHERE id = ? AND company_id = ?`,
      )
      .get(ctx.params.id, auth.companyId) as unknown as
      | { objectKey: string; mime: string; sizeBytes: number }
      | undefined
    if (!row) throw notFound('Файл не найден')

    ctx.res.writeHead(200, {
      'Content-Type': row.mime,
      'Content-Length': row.sizeBytes,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
    })
    createReadStream(resolve(env.storageDir, row.objectKey)).pipe(ctx.res)
    // Ответ уже пишется потоком — маршрутизатору возвращать нечего.
    return undefined
  })
}
