import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudOff } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { useSession } from '@/hooks/useSession'

/**
 * Общая рамка для входа и регистрации.
 *
 * Экраны разные по смыслу, но одинаковые по обрамлению: логотип, заголовок,
 * честное предупреждение о недоступном сервере и выход в автономный режим.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  const navigate = useNavigate()
  const { serverOnline, checking } = useSession()

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-12 lg:px-10">
      <div className="mx-auto w-full max-w-sm">
        <Logo />

        <h1 className="mt-8 text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{description}</p>

        {!checking && !serverOnline && (
          <div className="mt-5 flex gap-3 rounded-xl border border-clay/20 bg-clay-soft p-4">
            <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
            <p className="text-[0.8125rem] leading-relaxed text-graphite">
              Сервер не отвечает. Приложение продолжит работать локально: съёмка, параметры,
              визуализация и чертежи доступны без входа.
            </p>
          </div>
        )}

        {children}

        <div className="mt-4 space-y-1">
          {footer}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="block w-full rounded-lg py-2.5 text-[0.875rem] text-muted transition-colors hover:text-ink"
          >
            Продолжить без входа
          </button>
        </div>
      </div>
    </div>
  )
}

/** Ссылка-переход между входом и регистрацией. */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="block w-full rounded-lg py-2.5 text-[0.875rem] text-graphite transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  )
}
