import { AppError, type AppErrorCode } from '@/lib/errors'
import { API_URL, REQUEST_TIMEOUT } from './config'

function mapStatus(status: number): AppErrorCode {
  if (status === 404) return 'not_found'
  if (status === 413) return 'photo_too_large'
  if (status === 415) return 'photo_unsupported'
  if (status === 503) return 'unavailable'
  if (status >= 500) return 'server'
  return 'unknown'
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: BodyInit | null
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * Единая точка сетевого доступа. UI-компоненты не вызывают fetch напрямую.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      body: options.body ?? null,
      headers: options.headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new AppError(mapStatus(response.status), undefined, response.status)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError('network')
    }
    throw new AppError('network')
  } finally {
    clearTimeout(timeout)
  }
}

export function buildUrl(path: string): string {
  return `${API_URL}${path}`
}
