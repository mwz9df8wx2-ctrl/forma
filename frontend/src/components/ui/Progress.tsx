import { cn } from '@/lib/cn'

export interface ProgressProps {
  /** null — прогресс неизвестен, показываем бесконечный индикатор. */
  value: number | null
  label: string
  className?: string
}

export function Progress({ value, label, className }: ProgressProps) {
  const determinate = typeof value === 'number' && Number.isFinite(value)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(value) : undefined}
      aria-valuetext={determinate ? `${Math.round(value)}%` : 'Идёт обработка'}
      className={cn('relative h-1 w-full overflow-hidden rounded-full bg-line', className)}
    >
      {determinate ? (
        <div
          className="h-full rounded-full bg-clay transition-[width] duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      ) : (
        <div className="absolute inset-y-0 left-0 w-1/3 animate-indeterminate rounded-full bg-clay" />
      )}
    </div>
  )
}
