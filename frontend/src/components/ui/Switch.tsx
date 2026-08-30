import { useId } from 'react'
import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  className?: string
}

/** Переключатель на основе checkbox: доступен с клавиатуры и скринридера. */
export function Switch({ checked, onChange, label, description, className }: SwitchProps) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-12 cursor-pointer items-start gap-3 rounded-lg px-1 py-2.5 transition-colors duration-200',
        'hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          checked ? 'bg-ink' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'size-5 rounded-full bg-white shadow-hair transition-transform duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] leading-snug font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-faint">{description}</span>
        )}
      </span>
    </label>
  )
}
