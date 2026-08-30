import type { IncomingMessage, ServerResponse } from 'node:http'
import { HttpError, badRequest, tooLarge } from './errors.ts'

/** Минимальный маршрутизатор поверх node:http. Внешних зависимостей нет. */

export interface RequestContext {
  req: IncomingMessage
  res: ServerResponse
  params: Record<string, string>
  query: URLSearchParams
  /** Заполняется слоем аутентификации. */
  auth?: { userId: string; companyId: string; role: string }
}

export type Handler = (ctx: RequestContext) => Promise<unknown> | unknown

interface Route {
  method: string
  segments: string[]
  handler: Handler
}

const MAX_BODY_BYTES = 25 * 1024 * 1024

export class Router {
  private routes: Route[] = []

  add(method: string, path: string, handler: Handler): void {
    this.routes.push({ method, segments: path.split('/').filter(Boolean), handler })
  }

  get(path: string, handler: Handler) {
    this.add('GET', path, handler)
  }
  post(path: string, handler: Handler) {
    this.add('POST', path, handler)
  }
  patch(path: string, handler: Handler) {
    this.add('PATCH', path, handler)
  }
  delete(path: string, handler: Handler) {
    this.add('DELETE', path, handler)
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = pathname.split('/').filter(Boolean)
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== parts.length) continue
      const params: Record<string, string> = {}
      let matched = true
      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i]
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(parts[i])
        } else if (segment !== parts[i]) {
          matched = false
          break
        }
      }
      if (matched) return { handler: route.handler, params }
    }
    return null
  }
}

/** Тело запроса целиком. Превышение лимита — ошибка, а не молчаливая обрезка. */
export function readBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(tooLarge('Файл слишком большой'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const body = await readBody(req, 2 * 1024 * 1024)
  if (body.length === 0) throw badRequest('Пустое тело запроса')
  try {
    return JSON.parse(body.toString('utf8')) as T
  } catch {
    throw badRequest('Тело запроса не является корректным JSON')
  }
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

export function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.code, message: error.message })
    return
  }
  // Наружу отдаём обезличенный текст: стек попадает только в лог сервера.
  console.error('[сервер]', error)
  sendJson(res, 500, { error: 'internal', message: 'Внутренняя ошибка сервера' })
}

/** CORS для локальной разработки: фронтенд живёт на другом порту. */
export function applyCors(req: IncomingMessage, res: ServerResponse, origins: string[]): boolean {
  const origin = req.headers.origin
  if (origin && origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key')
    res.setHeader('Access-Control-Max-Age', '86400')
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}
