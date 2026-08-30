import { randomUUID } from 'node:crypto'

/** Идентификатор с префиксом: по нему сразу видно, что это за запись. */
export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
