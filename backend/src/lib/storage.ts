import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { db } from '../db/connection.ts'
import { env } from '../env.ts'
import { badRequest } from './errors.ts'
import { createId, nowIso } from './ids.ts'

/**
 * Хранилище файлов проекта.
 *
 * Одно место и для загрузок пользователя, и для результатов генерации:
 * иначе правила проверки типа и построения пути разъедутся между вызовами.
 */

export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Проверка по сигнатуре: расширение и заголовок Content-Type легко подделать. */
export function sniffMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  return null
}

export interface StoreFileInput {
  companyId: string
  projectId: string
  uploadedBy: string
  kind: string
  data: Buffer
  /** Ожидаемый тип. Если не совпал с сигнатурой — файл не принимается. */
  expectMime?: string
}

export async function storeFile(input: StoreFileInput): Promise<{ id: string; mime: string; sizeBytes: number }> {
  if (input.data.length === 0) throw badRequest('Пустой файл')
  const mime = sniffMime(input.data)
  if (!mime || !(mime in ALLOWED_MIME)) {
    throw badRequest('Поддерживаются только JPEG, PNG, WebP и PDF')
  }
  if (input.expectMime && input.expectMime !== mime) {
    throw badRequest('Содержимое файла не совпадает с заявленным типом')
  }

  const fileId = createId('fil')
  // Ключ формируем сами: имя из запроса в путь не попадает.
  const objectKey = `${input.companyId}/${input.projectId}/${fileId}.${ALLOWED_MIME[mime]}`
  const target = resolve(env.storageDir, objectKey)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, input.data)

  db()
    .prepare(
      `INSERT INTO project_files
         (id, company_id, project_id, uploaded_by, kind, object_key, mime, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fileId,
      input.companyId,
      input.projectId,
      input.uploadedBy,
      input.kind,
      objectKey,
      mime,
      input.data.length,
      nowIso(),
    )

  return { id: fileId, mime, sizeBytes: input.data.length }
}
