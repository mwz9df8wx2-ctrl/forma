import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid, Ruler, Sparkles, User } from 'lucide-react'
import { getGenerationSource } from '@/api'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: typeof Sparkles
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Новая', icon: Sparkles },
  { to: '/projects', label: 'Проекты', icon: LayoutGrid },
  { to: '/profile', label: 'Профиль', icon: User },
]

/** Разделы боковой панели: инструмент и то, что он даёт на выходе. */
const SIDEBAR_GROUPS: Array<{ title: string; items: Array<NavItem & { full: string }> }> = [
  {
    title: 'Визуализация',
    items: [{ to: '/', label: 'Новая', full: 'Новая визуализация', icon: Sparkles }],
  },
  {
    title: 'Производство',
    items: [{ to: '/drawings', label: 'Чертежи', full: 'Чертежи и спецификация', icon: Ruler }],
  },
  {
    title: 'Кабинет',
    items: [
      { to: '/projects', label: 'Проекты', full: 'Мои проекты', icon: LayoutGrid },
      { to: '/profile', label: 'Профиль', full: 'Профиль', icon: User },
    ],
  },
]

/** Нижняя навигация видна только на основных разделах — сценарий съёмки её не показывает. */
const TAB_ROUTES = new Set(['/', '/projects', '/profile'])

function BottomNav() {
  return (
    <nav
      aria-label="Основная навигация"
      className="safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pt-1.5 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors duration-200',
                  isActive ? 'text-ink' : 'text-faint hover:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    aria-hidden
                    className="size-[22px]"
                    strokeWidth={isActive ? 2.2 : 1.7}
                  />
                  <span className={cn('text-[0.6875rem]', isActive && 'font-semibold')}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-5 py-6 lg:flex">
      <div className="px-1">
        <Logo />
      </div>

      <nav aria-label="Разделы" className="mt-8 space-y-6">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="eyebrow mb-2 px-3">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.875rem] whitespace-nowrap transition-colors duration-200',
                        isActive
                          ? 'bg-surface-3 font-medium text-ink'
                          : 'text-muted hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    <item.icon aria-hidden className="size-[18px]" />
                    {item.full}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <SourceNote />
    </aside>
  )
}

/** Подсказка внизу боковой панели: чем сейчас создаются визуализации. */
function SourceNote() {
  const source = getGenerationSource()
  const title =
    source === 'server'
      ? 'Подключён рабочий сервер'
      : source === 'ai'
        ? 'Подключён сервис генерации'
        : 'Автономный режим'
  const text =
    source === 'server'
      ? 'Визуализации создаются на сервере.'
      : source === 'ai'
        ? 'Изображения создаёт подключённый сервис ИИ.'
        : 'Визуализации считаются на этом устройстве, сервер не требуется.'

  return (
    <div className="mt-auto rounded-xl border border-line bg-surface-2 p-3.5">
      <p className="text-[0.8125rem] leading-snug font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs leading-snug text-muted">{text}</p>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const showTabs = TAB_ROUTES.has(pathname)

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className={cn('flex min-w-0 flex-1 flex-col', showTabs && 'pb-[72px] lg:pb-0')}>
        {children}
      </div>
      {showTabs && <BottomNav />}
    </div>
  )
}

/** Заголовок раздела на телефоне: логотип сверху, крупный заголовок ниже. */
export function PageHeader({
  title,
  subtitle,
  action,
  showLogo,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  showLogo?: boolean
}) {
  return (
    <header className="safe-top px-5 pt-5 lg:px-10 lg:pt-10">
      {showLogo && (
        <div className="mb-7 lg:hidden">
          <Logo />
        </div>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-ink lg:text-[2rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-muted">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}
