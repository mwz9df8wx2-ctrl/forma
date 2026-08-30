import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudOff } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'

type Mode = 'login' | 'register'

/** Вход и регистрация компании. Без сервера экран честно об этом говорит. */
export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signUp, serverOnline, checking } = useSession()
  const { show, showError } = useToast()

  const [mode, setMode] = useState<Mode>('login')
  const [busy, setBusy] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async () => {
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        await signUp({ companyName: companyName.trim(), name: name.trim(), email: email.trim(), password })
      }
      show({ title: 'Вы вошли', variant: 'success' })
      navigate('/projects')
    } catch (error) {
      showError(toAppError(error, 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= 8 &&
    (mode === 'login' || (companyName.trim().length > 1 && name.trim().length > 1))

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-12 lg:px-10">
      <div className="mx-auto w-full max-w-sm">
        <Logo />

        <h1 className="mt-8 text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink">
          {mode === 'login' ? 'Вход' : 'Регистрация компании'}
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          {mode === 'login'
            ? 'Проекты и файлы хранятся на сервере компании.'
            : 'Создайте компанию — проекты, каталог и доступы будут привязаны к ней.'}
        </p>

        {!checking && !serverOnline && (
          <div className="mt-5 flex gap-3 rounded-xl border border-clay/20 bg-clay-soft p-4">
            <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
            <p className="text-[0.8125rem] leading-relaxed text-graphite">
              Сервер не отвечает. Приложение продолжит работать локально: съёмка, параметры,
              визуализация и чертежи доступны без входа.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {mode === 'register' && (
            <>
              <Input
                label="Название компании"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Мебельная мастерская"
                autoComplete="organization"
              />
              <Input
                label="Ваше имя"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </>
          )}
          <Input
            label="Рабочая почта"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            hint={mode === 'register' ? 'Не короче восьми символов' : undefined}
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-6"
          loading={busy}
          disabled={!canSubmit || !serverOnline}
          onClick={() => void submit()}
        >
          {mode === 'login' ? 'Войти' : 'Создать компанию'}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className={cn(
            'mt-4 block w-full rounded-lg py-2.5 text-[0.875rem] text-graphite transition-colors',
            'hover:bg-surface-2 hover:text-ink',
          )}
        >
          {mode === 'login' ? 'Зарегистрировать компанию' : 'У меня уже есть аккаунт'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-1 block w-full rounded-lg py-2.5 text-[0.875rem] text-muted transition-colors hover:text-ink"
        >
          Продолжить без входа
        </button>
      </div>
    </div>
  )
}
