import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'paper flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface text-muted shadow-hair [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[0.875rem] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
