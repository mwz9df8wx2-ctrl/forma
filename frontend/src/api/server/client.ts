import { AppError } from '@/lib/errors'
import { readStorage, removeStorage, writeStorage } from '@/lib/storage'

/**
 * Клиент серверного API.
 *
 * Токен сессии хранится на устройстве, ключи провайдеров — нет: они живут
 * только на сервере. Фронтенд их не получает и не может получить.
 */

const TOKEN_KEY = 'forma.session.v1'

export const SERVER_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api/v1'
).replace(/\/+$/, '')

export interface Session {
  token: string
  expiresAt: string
  user: {
    id: string
    email: string
    name: string
    role: string
    companyId: string
    companyName: string
  }
}

export function loadSession(): Session | null {
  const session = readStorage<Session | null>(TOKEN_KEY, null)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    removeStorage(TOKEN_KEY)
    return null
  }
  return session
}

export function saveSession(session: Session): void {
  writeStorage(TOKEN_KEY, session)
}

export function clearSession(): void {
  removeStorage(TOKEN_KEY)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  raw?: Blob
  headers?: Record<string, string>
  signal?: AbortSignal
}

function mapStatus(status: number): AppError['code'] {
  if (status === 401 || status === 403) return 'not_found'
  if (status === 404) return 'not_found'
  if (status === 413) return 'photo_too_large'
  if (status === 503) return 'unavailable'
  if (status >= 500) return 'server'
  return 'unknown'
}

/** Запрос к серверу. Токен подставляется автоматически. */
export async function serverRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = loadSession()
  const headers: Record<string, string> = { ...options.headers }
  if (session) headers.Authorization = `Bearer ${session.token}`

  let body: BodyInit | undefined
  if (options.raw) {
    body = options.raw
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(`${SERVER_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    })
  } catch {
    throw new AppError('network')
  }

  if (response.status === 401) {
    clearSession()
    throw new AppError('not_found', 'Сессия истекла. Войдите заново.')
  }

  if (!response.ok) {
    let message: string | undefined
    try {
      const payload = (await response.json()) as { message?: string }
      message = payload.message
    } catch {
      /* тело может быть пустым */
    }
    throw new AppError(mapStatus(response.status), message, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Доступен ли сервер. Используется, чтобы не показывать вход впустую. */
export async function serverAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/health`, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}
