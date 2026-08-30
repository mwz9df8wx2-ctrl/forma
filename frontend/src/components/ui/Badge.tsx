import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'inverse' | 'light'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-graphite',
  accent: 'bg-clay-soft text-clay',
  success: 'bg-success/12 text-success',
  inverse: 'bg-ink/85 text-white backdrop-blur-sm',
  light: 'bg-white/85 text-graphite backdrop-blur-sm',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.6875rem] font-semibold tracking-[0.06em] uppercase',
        TONES[tone],
        className,
      )}
    >
      {icon && <span className="[&_svg]:size-3">{icon}</span>}
      {children}
    </span>
  )
}
