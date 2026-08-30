import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { db } from '../db/connection.ts'
import { env } from '../env.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { readBody, type Router } from '../lib/http.ts'
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

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const FILE_KINDS = new Set([
  'room_photo',
  'sketch',
  'detail_photo',
  'reference',
  'catalog_sample',
  'visualization',
  'technical_pdf',
])

/** Проверка по сигнатуре: расширение и заголовок Content-Type легко подделать. */
function sniffMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  return null
}

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
    if (body.length === 0) throw badRequest('Пустой файл')

    const mime = sniffMime(body)
    if (!mime || !(mime in ALLOWED_MIME)) {
      throw badRequest('Поддерживаются только JPEG, PNG, WebP и PDF')
    }

    const fileId = createId('fil')
    // Ключ формируем сами: имя из запроса в путь не попадает.
    const objectKey = `${auth.companyId}/${project.id}/${fileId}.${ALLOWED_MIME[mime]}`
    const target = resolve(env.storageDir, objectKey)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, body)

    db()
      .prepare(
        `INSERT INTO project_files
           (id, company_id, project_id, uploaded_by, kind, object_key, mime, size_bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(fileId, auth.companyId, project.id, auth.userId, kind, objectKey, mime, body.length, nowIso())

    writeAudit(auth, 'file.uploaded', project.id, { fileId, kind, size: body.length })
    return { file: { id: fileId, kind, mime, sizeBytes: body.length, url: `/api/v1/files/${fileId}` } }
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
