import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'

/** Шапка сценария: возврат, название, вспомогательное действие. */
export function FlowHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Назад',
  action,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  action?: ReactNode
}) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-canvas/92 backdrop-blur-md">
      <div className="flex items-center gap-3 px-3 py-2.5 lg:px-6 lg:py-3.5">
        {onBack && (
          <IconButton label={backLabel} onClick={onBack} variant="ghost">
            <ArrowLeft className="size-5" />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] leading-tight font-semibold tracking-[-0.01em] text-ink">
            {title}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
