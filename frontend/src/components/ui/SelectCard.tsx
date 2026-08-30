import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectCardProps {
  name: string
  value: string
  checked: boolean
  onSelect: (value: string) => void
  title: string
  caption?: string
  description?: string
  preview?: ReactNode
  /** tile — карточка с превью сверху, row — компактная строка. */
  layout?: 'tile' | 'row'
  className?: string
}

/**
 * Карточка выбора на основе настоящего radio input:
 * работает клавиатура, скринридер и группировка по name.
 */
export function SelectCard({
  name,
  value,
  checked,
  onSelect,
  title,
  caption,
  description,
  preview,
  layout = 'tile',
  className,
}: SelectCardProps) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface',
        'transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas',
        checked
          ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]'
          : 'border-line hover:border-line-strong hover:shadow-card md:hover:-translate-y-0.5',
        layout === 'row' && 'flex-row items-center gap-3 p-3',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />

      {preview && (
        <div className={cn('relative', layout === 'tile' ? 'w-full' : 'shrink-0')}>{preview}</div>
      )}

      <div
        className={cn(
          'min-w-0 flex-1',
          layout === 'tile' && 'px-3 pt-2.5 pb-3',
          layout === 'row' && 'py-0.5',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.9375rem] leading-tight font-medium text-ink">{title}</p>
          <span
            aria-hidden
            className={cn(
              'mt-px flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
              checked
                ? 'scale-100 border-ink bg-ink text-white opacity-100'
                : 'scale-90 border-line-strong bg-transparent text-transparent opacity-0 group-hover:opacity-100',
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
        </div>
        {caption && <p className="mt-0.5 text-[0.8125rem] text-muted">{caption}</p>}
        {description && <p className="mt-1.5 text-xs leading-snug text-faint">{description}</p>}
      </div>
    </label>
  )
}
