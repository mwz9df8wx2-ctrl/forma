import { useNavigate } from 'react-router-dom'
import { Building2, CloudOff, LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'

/** Компания и вход. Без сервера приложение работает локально. */
export function AccountCard() {
  const navigate = useNavigate()
  const { session, serverOnline, checking, signOut } = useSession()
  const { show } = useToast()

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
          <Building2 aria-hidden className="size-4 text-muted" />
          Компания
        </h2>
        <Badge tone={session ? 'success' : 'neutral'}>{session ? 'Вход выполнен' : 'Локально'}</Badge>
      </div>

      {session ? (
        <>
          <p className="text-[0.9375rem] font-medium text-ink">{session.user.companyName}</p>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {session.user.name} · {session.user.email}
          </p>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
            Проекты и файлы хранятся на сервере компании. Ключи провайдеров тоже — в браузер
            они не попадают.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mt-4"
            icon={<LogOut />}
            onClick={async () => {
              await signOut()
              show({ title: 'Вы вышли', variant: 'success' })
            }}
          >
            Выйти
          </Button>
        </>
      ) : (
        <>
          <p className="text-[0.875rem] leading-relaxed text-muted">
            Без входа приложение работает на этом устройстве: съёмка, параметры, визуализация и
            чертежи доступны. Проекты компании, общий каталог и ключи на сервере требуют входа.
          </p>
          {!checking && !serverOnline && (
            <div className="mt-3 flex gap-2.5 rounded-lg border border-line bg-surface-2 p-3">
              <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
              <p className="text-xs leading-relaxed text-muted">
                Сервер сейчас не отвечает. Запустите его командой{' '}
                <span className="font-medium text-ink">npm run dev</span> в каталоге backend.
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Button
              variant="primary"
              size="md"
              disabled={!serverOnline}
              onClick={() => navigate('/register')}
            >
              Зарегистрировать компанию
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={!serverOnline}
              onClick={() => navigate('/login')}
            >
              Войти
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
