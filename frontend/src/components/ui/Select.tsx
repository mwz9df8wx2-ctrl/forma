import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string
  options: SelectOption[]
  hint?: string
}

export function Select({ label, options, hint, className, id, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="min-w-0">
      <label htmlFor={selectId} className="mb-1.5 block text-[0.8125rem] font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'h-12 w-full appearance-none rounded-lg border border-line-strong bg-surface pr-10 pl-3.5',
            'text-[0.9375rem] font-medium transition-colors duration-200',
            'focus:border-ink/60 focus:ring-2 focus:ring-ink/8 focus:outline-none',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-faint"
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  )
}
