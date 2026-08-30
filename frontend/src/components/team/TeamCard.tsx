import { useCallback, useEffect, useState } from 'react'
import { Copy, UserPlus, UserX } from 'lucide-react'
import type { Role } from '@shared/index'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '@shared/index'
import {
  inviteUser,
  listInvitations,
  listUsers,
  revokeInvitation,
  updateUser,
  type CompanyUser,
  type Invitation,
} from '@/api/server/team'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { usePermissions } from '@/hooks/usePermissions'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format'

/**
 * Сотрудники компании.
 *
 * Ссылка приглашения показывается один раз: на сервере хранится только её
 * отпечаток. Восстановить её нельзя — можно выпустить новую.
 */
export function TeamCard() {
  const { session } = useSession()
  const { can } = usePermissions()
  const { show, showError } = useToast()

  const [users, setUsers] = useState<CompanyUser[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('estimator')
  const [issuedLink, setIssuedLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!session || !can('users.manage')) return
    try {
      const [people, pending] = await Promise.all([listUsers(), listInvitations()])
      setUsers(people)
      setInvitations(pending)
    } catch (error) {
      showError(error)
    }
  }, [session, can, showError])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!session || !can('users.manage')) return null

  const handleInvite = async () => {
    setBusy(true)
    try {
      const { token } = await inviteUser(email.trim().toLowerCase(), role)
      setIssuedLink(`${window.location.origin}/invite?token=${encodeURIComponent(token)}`)
      setEmail('')
      await refresh()
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (user: CompanyUser, next: Role) => {
    try {
      await updateUser(user.id, { role: next })
      await refresh()
      show({ title: `${user.name}: роль изменена`, variant: 'success' })
    } catch (error) {
      showError(error)
    }
  }

  const disable = async (user: CompanyUser) => {
    try {
      await updateUser(user.id, { active: !user.active })
      await refresh()
    } catch (error) {
      showError(error)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.0625rem] font-semibold text-ink">Сотрудники</h2>
        <Button variant="secondary" size="sm" icon={<UserPlus />} onClick={() => setInviting(true)}>
          Пригласить
        </Button>
      </div>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
        Роль решает, кто меняет каталог и цены, кто согласовывает проект и кто тратит AI-кредиты.
      </p>

      <ul className="mt-4 divide-y divide-line">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium text-ink">
                {user.name}
                {user.id === session.user.id && <span className="ml-2 text-xs text-faint">это вы</span>}
              </p>
              <p className="truncate text-[0.8125rem] text-muted">{user.email}</p>
            </div>
            {!user.active && <Badge tone="neutral">Отключён</Badge>}
            <div className="w-44">
              <Select
                label="Роль"
                hideLabel
                value={user.role}
                onChange={(event) => void changeRole(user, event.target.value as Role)}
                options={ROLES.map((item) => ({ value: item, label: ROLE_LABELS[item] }))}
              />
            </div>
            {user.id !== session.user.id && (
              <Button
                variant="ghost"
                size="sm"
                icon={<UserX />}
                onClick={() => void disable(user)}
              >
                {user.active ? 'Отключить' : 'Включить'}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {invitations.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="eyebrow mb-1">Приглашения ждут ответа</p>
          <ul className="divide-y divide-line">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-[0.875rem] text-muted">
                  {invitation.email} · {ROLE_LABELS[invitation.role]}
                  <span className="ml-2 text-faint">до {formatDate(invitation.expiresAt)}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void revokeInvitation(invitation.id)
                      .then(refresh)
                      .catch(showError)
                  }
                >
                  Отозвать
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={inviting}
        title="Пригласить сотрудника"
        onClose={() => {
          setInviting(false)
          setIssuedLink(null)
        }}
        footer={
          issuedLink ? (
            <Button
              variant="primary"
              size="md"
              fullWidth
              icon={<Copy />}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(issuedLink)
                  .then(() => show({ title: 'Ссылка скопирована', variant: 'success' }))
                  .catch(() => show({ title: 'Скопируйте ссылку вручную', variant: 'info' }))
              }}
            >
              Скопировать ссылку
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              fullWidth
              disabled={email.trim().length < 3 || busy}
              loading={busy}
              onClick={() => void handleInvite()}
            >
              Создать приглашение
            </Button>
          )
        }
      >
        {issuedLink ? (
          <div className="space-y-3">
            <p className="text-[0.875rem] leading-relaxed text-muted">
              Передайте ссылку сотруднику. Пароль он задаст сам — так его не увидит никто,
              включая вас.
            </p>
            <p className="rounded-lg border border-line bg-surface-2 p-3 font-mono text-[0.75rem] leading-relaxed break-all text-graphite">
              {issuedLink}
            </p>
            <p className="text-[0.8125rem] leading-snug text-clay">
              Ссылка показывается один раз. Если потеряете — выпустите новую.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Рабочая почта"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="master@company.ru"
            />
            <Select
              label="Роль"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              options={ROLES.map((item) => ({ value: item, label: ROLE_LABELS[item] }))}
            />
            <p className="text-[0.8125rem] leading-relaxed text-muted">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        )}
      </Modal>
    </section>
  )
}
