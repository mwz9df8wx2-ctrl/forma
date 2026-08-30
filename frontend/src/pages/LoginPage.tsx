import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout, AuthLink } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'
import { toAppError } from '@/lib/errors'
import { emailError } from '@/lib/validation'

/** Вход в компанию. Без сервера экран честно об этом говорит. */
export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, serverOnline } = useSession()
  const { show, showError } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const emailProblem = emailError(email)

  const submit = async () => {
    setTouched(true)
    if (emailProblem || password.length === 0) return
    setBusy(true)
    try {
      await signIn(email.trim().toLowerCase(), password)
      show({ title: 'Вы вошли', variant: 'success' })
      navigate('/projects')
    } catch (error) {
      showError(toAppError(error, 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Вход"
      description="Проекты, каталог и файлы хранятся на сервере компании."
      footer={<AuthLink to="/register">Зарегистрировать компанию</AuthLink>}
    >
      <div className="mt-6 space-y-3">
        <Input
          label="Рабочая почта"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched(true)}
          autoComplete="email"
          inputMode="email"
          error={touched ? (emailProblem ?? undefined) : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
        />
        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        className="mt-6"
        loading={busy}
        disabled={busy || !serverOnline}
        onClick={() => void submit()}
      >
        Войти
      </Button>

      {!serverOnline && (
        <p className="mt-2 text-center text-xs text-clay">
          Вход возможен только при доступном сервере.
        </p>
      )}
    </AuthLayout>
  )
}
