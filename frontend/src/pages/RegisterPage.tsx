import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout, AuthLink } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'
import { toAppError } from '@/lib/errors'
import { emailError, passwordError, repeatError, requiredError } from '@/lib/validation'

/**
 * Регистрация компании.
 *
 * Регистрируется не человек, а компания: к ней привязаны проекты, каталог,
 * сотрудники и кредиты. Тот, кто регистрирует, становится её владельцем.
 */
export function RegisterPage() {
  const navigate = useNavigate()
  const { signUp, serverOnline } = useSession()
  const { show, showError } = useToast()

  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const errors = {
    companyName: requiredError(companyName, 'Название компании'),
    name: requiredError(name, 'Ваше имя'),
    email: emailError(email),
    password: passwordError(password),
    repeat: repeatError(password, repeat),
  }
  const valid = Object.values(errors).every((error) => error === null)

  // Ошибку показываем после того, как поле трогали: подсвечивать пустую форму
  // при первом открытии — значит ругаться раньше, чем человек начал вводить.
  const errorOf = (field: keyof typeof errors) =>
    touched[field] ? (errors[field] ?? undefined) : undefined
  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }))

  const submit = async () => {
    setTouched({ companyName: true, name: true, email: true, password: true, repeat: true })
    if (!valid) return
    setBusy(true)
    try {
      await signUp({
        companyName: companyName.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      show({ title: 'Компания создана', description: 'Вы её владелец.', variant: 'success' })
      navigate('/projects')
    } catch (error) {
      showError(toAppError(error, 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Регистрация компании"
      description="Проекты, каталог, сотрудники и AI-кредиты привязаны к компании. Тот, кто её создаёт, становится владельцем."
      footer={<AuthLink to="/login">У меня уже есть аккаунт</AuthLink>}
    >
      <div className="mt-6 space-y-3">
        <Input
          label="Название компании"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          onBlur={() => markTouched('companyName')}
          placeholder="Мебельная мастерская"
          autoComplete="organization"
          error={errorOf('companyName')}
        />
        <Input
          label="Ваше имя"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => markTouched('name')}
          autoComplete="name"
          error={errorOf('name')}
        />
        <Input
          label="Рабочая почта"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => markTouched('email')}
          autoComplete="email"
          inputMode="email"
          error={errorOf('email')}
          hint={errorOf('email') ? undefined : 'По ней вы будете входить.'}
        />
        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => markTouched('password')}
          autoComplete="new-password"
          error={errorOf('password')}
          hint={errorOf('password') ? undefined : 'Не короче восьми символов.'}
        />
        <Input
          label="Повторите пароль"
          type="password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          onBlur={() => markTouched('repeat')}
          autoComplete="new-password"
          error={errorOf('repeat')}
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
        Создать компанию
      </Button>

      {!serverOnline && (
        <p className="mt-2 text-center text-xs text-clay">
          Регистрация возможна только при доступном сервере.
        </p>
      )}
    </AuthLayout>
  )
}
