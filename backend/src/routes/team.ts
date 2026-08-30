import { createHash, randomBytes } from 'node:crypto'
import * as z from 'zod'
import { db, transaction } from '../db/connection.ts'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.ts'
import { createId, nowIso } from '../lib/ids.ts'
import { hashPassword } from '../lib/password.ts'
import { readJson, type Router } from '../lib/http.ts'
import { writeAudit } from '../lib/audit.ts'
import { issueSession, requireAuth, requirePermission } from './auth.ts'
import { roleSchema, ROLE_LABELS, ROLE_PERMISSIONS } from '../../../shared/src/index.ts'

/**
 * Сотрудники компании.
 *
 * Пароль сотрудник задаёт сам по одноразовой ссылке. Владелец не должен знать
 * чужой пароль, а временный пароль, отправленный в переписке, живёт там
 * гораздо дольше, чем нужно.
 */

const INVITE_DAYS = 7

const inviteSchema = z.object({
  email: z.string().min(3).max(200),
  role: roleSchema,
})

const acceptSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
})

const updateUserSchema = z.object({
  role: roleSchema.optional(),
  active: z.boolean().optional(),
})

/** В базе хранится только отпечаток: утёкшая копия таблицы не даёт доступа. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function countOwners(companyId: string, exceptUserId?: string): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS count FROM users
        WHERE company_id = ? AND role = 'owner' AND active = 1 AND id != ?`,
    )
    .get(companyId, exceptUserId ?? '') as unknown as { count: number }
  return row.count
}

export function registerTeamRoutes(router: Router): void {
  router.get('/api/v1/users', (ctx) => {
    const auth = requirePermission(ctx, 'users.manage')
    const users = db()
      .prepare(
        `SELECT id, email, name, role, active, created_at AS createdAt
           FROM users WHERE company_id = ? ORDER BY created_at`,
      )
      .all(auth.companyId) as unknown as {
      id: string
      email: string
      name: string
      role: string
      active: number
      createdAt: string
    }[]

    return {
      users: users.map((user) => ({
        ...user,
        active: user.active === 1,
        roleLabel: ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role,
      })),
    }
  })

  router.post('/api/v1/users/invitations', async (ctx) => {
    const auth = requirePermission(ctx, 'users.manage')
    const input = inviteSchema.parse(await readJson(ctx.req))
    const email = input.email.trim().toLowerCase()

    const existing = db().prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) throw conflict('Пользователь с такой почтой уже зарегистрирован')

    const plan = db()
      .prepare(
        `SELECT p.max_users AS maxUsers FROM subscriptions s
           JOIN plans p ON p.id = s.plan_id
          WHERE s.company_id = ? AND s.status = 'active'
          ORDER BY s.created_at DESC LIMIT 1`,
      )
      .get(auth.companyId) as unknown as { maxUsers: number } | undefined
    const current = db()
      .prepare('SELECT COUNT(*) AS count FROM users WHERE company_id = ? AND active = 1')
      .get(auth.companyId) as unknown as { count: number }
    if (plan && current.count >= plan.maxUsers) {
      throw conflict(`На вашем тарифе не больше ${plan.maxUsers} сотрудников`)
    }

    // Токен показывается один раз: в базе остаётся только отпечаток.
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString()
    const id = createId('inv')

    db()
      .prepare(
        `INSERT INTO invitations
           (id, company_id, email, role, token_hash, invited_by, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, auth.companyId, email, input.role, hashToken(token), auth.userId, expires, nowIso())

    writeAudit(auth, 'user.invited', null, { email, role: input.role })
    return {
      invitation: { id, email, role: input.role, expiresAt: expires },
      // Ссылку показываем один раз — повторно её не восстановить.
      token,
    }
  })

  router.get('/api/v1/users/invitations', (ctx) => {
    const auth = requirePermission(ctx, 'users.manage')
    const rows = db()
      .prepare(
        `SELECT id, email, role, expires_at AS expiresAt, created_at AS createdAt
           FROM invitations
          WHERE company_id = ? AND accepted_at IS NULL AND expires_at > ?
          ORDER BY created_at DESC`,
      )
      .all(auth.companyId, nowIso())
    return { invitations: rows }
  })

  router.delete('/api/v1/users/invitations/:id', (ctx) => {
    const auth = requirePermission(ctx, 'users.manage')
    const result = db()
      .prepare('DELETE FROM invitations WHERE id = ? AND company_id = ? AND accepted_at IS NULL')
      .run(ctx.params.id, auth.companyId)
    if (result.changes === 0) throw notFound('Приглашение не найдено')
    writeAudit(auth, 'user.invitation.revoked', null, { invitationId: ctx.params.id })
    return { ok: true }
  })

  /** Приём приглашения. Открытый маршрут: приглашённый ещё не вошёл. */
  router.post('/api/v1/auth/accept-invitation', async (ctx) => {
    const input = acceptSchema.parse(await readJson(ctx.req))
    const invitation = db()
      .prepare(
        `SELECT id, company_id AS companyId, email, role, expires_at AS expiresAt
           FROM invitations WHERE token_hash = ? AND accepted_at IS NULL`,
      )
      .get(hashToken(input.token)) as unknown as
      | { id: string; companyId: string; email: string; role: string; expiresAt: string }
      | undefined

    // Один и тот же ответ на неизвестный и на просроченный токен:
    // по коду ответа не должно быть видно, существовала ли ссылка.
    if (!invitation || invitation.expiresAt < nowIso()) {
      throw badRequest('Приглашение недействительно или истекло')
    }

    const taken = db().prepare('SELECT id FROM users WHERE email = ?').get(invitation.email)
    if (taken) throw conflict('Пользователь с такой почтой уже зарегистрирован')

    return transaction(() => {
      const userId = createId('usr')
      db()
        .prepare(
          `INSERT INTO users (id, company_id, email, name, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          invitation.companyId,
          invitation.email,
          input.name,
          hashPassword(input.password),
          invitation.role,
          nowIso(),
        )
      db()
        .prepare('UPDATE invitations SET accepted_at = ? WHERE id = ?')
        .run(nowIso(), invitation.id)

      const session = issueSession(userId)
      const user = db()
        .prepare(
          `SELECT u.id, u.email, u.name, u.role, c.id AS companyId, c.name AS companyName
             FROM users u JOIN companies c ON c.id = u.company_id WHERE u.id = ?`,
        )
        .get(userId)
      return { token: session.token, expiresAt: session.expiresAt, user }
    })
  })

  router.patch('/api/v1/users/:id', async (ctx) => {
    const auth = requirePermission(ctx, 'users.manage')
    const input = updateUserSchema.parse(await readJson(ctx.req))

    const user = db()
      .prepare('SELECT id, role, active FROM users WHERE id = ? AND company_id = ?')
      .get(ctx.params.id, auth.companyId) as unknown as
      | { id: string; role: string; active: number }
      | undefined
    if (!user) throw notFound('Сотрудник не найден')

    // Компания без владельца становится неуправляемой: восстановить доступ
    // можно будет только через поддержку.
    const losingOwner =
      user.role === 'owner' && (input.role !== undefined ? input.role !== 'owner' : input.active === false)
    if (losingOwner && countOwners(auth.companyId, user.id) === 0) {
      throw forbidden('В компании должен остаться хотя бы один владелец')
    }
    if (user.id === auth.userId && input.active === false) {
      throw forbidden('Нельзя отключить собственную учётную запись')
    }

    const sets: string[] = []
    const values: (string | number)[] = []
    if (input.role !== undefined) {
      sets.push('role = ?')
      values.push(input.role)
    }
    if (input.active !== undefined) {
      sets.push('active = ?')
      values.push(input.active ? 1 : 0)
    }
    if (sets.length === 0) throw badRequest('Нечего менять')
    values.push(user.id)

    db().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    // Отключённый сотрудник не должен доработать смену по старому токену.
    if (input.active === false) {
      db().prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
    }

    writeAudit(auth, 'user.updated', null, { userId: user.id, role: input.role ?? null })
    const updated = db()
      .prepare('SELECT id, email, name, role, active FROM users WHERE id = ?')
      .get(user.id) as unknown as { id: string; email: string; name: string; role: string; active: number }
    return { user: { ...updated, active: updated.active === 1 } }
  })

  /** Свои права: интерфейс не должен угадывать, что доступно. */
  router.get('/api/v1/users/me/permissions', (ctx) => {
    const auth = requireAuth(ctx)
    return {
      role: auth.role,
      permissions: [...(ROLE_PERMISSIONS[auth.role as keyof typeof ROLE_PERMISSIONS] ?? [])],
    }
  })
}
