import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ParameterSection({
  id,
  eyebrow,
  children,
  className,
}: {
  id: string
  eyebrow: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-28 border-t border-line pt-6 first:border-t-0 first:pt-0', className)}
    >
      <h2 id={`${id}-title`} className="eyebrow mb-4">
        {eyebrow}
      </h2>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

export function Field({
  label,
  value,
  children,
  hint,
}: {
  label: string
  value?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">{label}</h3>
        {value && (
          <span className="truncate text-[0.8125rem] text-muted" aria-hidden>
            {value}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-2.5 text-xs leading-snug text-faint">{hint}</p>}
    </div>
  )
}
