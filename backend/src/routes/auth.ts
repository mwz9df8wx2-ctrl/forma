import { randomBytes } from 'node:crypto'
import * as z from 'zod'
import { db, transaction } from '../db/connection.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { badRequest, unauthorized } from '../lib/errors.ts'
import { hashPassword, verifyPassword } from '../lib/password.ts'
import { readJson, type RequestContext, type Router } from '../lib/http.ts'

/** Вход, регистрация компании и текущий пользователь. */

const SESSION_DAYS = 30

const registerSchema = z.object({
  companyName: z.string().min(2).max(120),
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
})

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export interface AuthUser {
  userId: string
  companyId: string
  role: string
}

function issueSession(userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  db()
    .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, nowIso(), expiresAt)
  return { token, expiresAt }
}

/** Разбор заголовка Authorization. Возвращает null, если сессии нет. */
export function authenticate(header: string | undefined): AuthUser | null {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const row = db()
    .prepare(
      `SELECT s.expires_at AS expiresAt, u.id AS userId, u.company_id AS companyId,
              u.role AS role, u.active AS active
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
    )
    .get(token) as unknown as
    | { expiresAt: string; userId: string; companyId: string; role: string; active: number }
    | undefined

  if (!row || row.active !== 1) return null
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    db().prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return null
  }
  return { userId: row.userId, companyId: row.companyId, role: row.role }
}

export function requireAuth(ctx: RequestContext): AuthUser {
  if (!ctx.auth) throw unauthorized()
  return ctx.auth
}

function publicUser(userId: string) {
  return db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, c.id AS companyId, c.name AS companyName
         FROM users u JOIN companies c ON c.id = u.company_id
        WHERE u.id = ?`,
    )
    .get(userId)
}

export function registerAuthRoutes(router: Router): void {
  router.post('/api/v1/auth/register', async ({ req }) => {
    const input = registerSchema.parse(await readJson(req))
    const existing = db().prepare('SELECT id FROM users WHERE email = ?').get(input.email)
    if (existing) throw badRequest('Пользователь с такой почтой уже существует')

    return transaction(() => {
      const now = nowIso()
      const companyId = createId('cmp')
      const userId = createId('usr')

      db()
        .prepare('INSERT INTO companies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(companyId, input.companyName, now, now)
      db()
        .prepare(
          `INSERT INTO users (id, company_id, email, name, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, ?, 'owner', ?)`,
        )
        .run(userId, companyId, input.email, input.name, hashPassword(input.password), now)

      const session = issueSession(userId)
      return { token: session.token, expiresAt: session.expiresAt, user: publicUser(userId) }
    })
  })

  router.post('/api/v1/auth/login', async ({ req }) => {
    const input = loginSchema.parse(await readJson(req))
    const row = db()
      .prepare('SELECT id, password_hash AS hash, active FROM users WHERE email = ?')
      .get(input.email) as unknown as { id: string; hash: string; active: number } | undefined

    // Один и тот же ответ на неизвестную почту и неверный пароль.
    if (!row || row.active !== 1 || !verifyPassword(input.password, row.hash)) {
      throw unauthorized('Неверная почта или пароль')
    }

    const session = issueSession(row.id)
    return { token: session.token, expiresAt: session.expiresAt, user: publicUser(row.id) }
  })

  router.post('/api/v1/auth/logout', async ({ req }) => {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      db().prepare('DELETE FROM sessions WHERE token = ?').run(header.slice(7))
    }
    return { ok: true }
  })

  router.get('/api/v1/auth/me', (ctx) => {
    const auth = requireAuth(ctx)
    return { user: publicUser(auth.userId) }
  })
}
