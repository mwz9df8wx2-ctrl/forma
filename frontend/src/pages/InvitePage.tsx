import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { acceptInvitation } from '@/api/server/team'
import { saveSession } from '@/api/server/client'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'

/**
 * Приём приглашения.
 *
 * Пароль сотрудник задаёт сам: владелец компании не должен его знать,
 * а временный пароль, отправленный в переписке, живёт там слишком долго.
 */
export function InvitePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { show, showError } = useToast()

  const token = params.get('token') ?? ''
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const session = await acceptInvitation({ token, name: name.trim(), password })
      saveSession(session)
      show({ title: `Добро пожаловать, ${session.user.name}`, variant: 'success' })
      // Полная перезагрузка: провайдеры перечитают сессию и права.
      window.location.assign('/')
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  const ready = token.length > 20 && name.trim().length > 0 && password.length >= 8

  return (
    <div className="flex flex-1 flex-col justify-center px-5 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-sm">
        <Logo />
        <h1 className="mt-7 text-[1.625rem] leading-tight font-semibold tracking-[-0.025em] text-ink">
          Присоединиться к компании
        </h1>

        {token.length < 20 ? (
          <>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
              Ссылка приглашения неполная. Попросите владельца компании выпустить новую.
            </p>
            <Button variant="secondary" size="lg" className="mt-6" onClick={() => navigate('/login')}>
              К входу
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
              Пароль вы задаёте сами — его не увидит никто, включая владельца компании.
            </p>

            <div className="mt-7 space-y-4">
              <Input
                label="Как вас зовут"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
              <Input
                label="Пароль"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                hint="Не короче 8 символов."
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-6"
              disabled={!ready || busy}
              loading={busy}
              onClick={() => void submit()}
            >
              Присоединиться
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
