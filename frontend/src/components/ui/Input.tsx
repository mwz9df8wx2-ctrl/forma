import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  /** Подпись остаётся для программ чтения экрана, но не занимает место. */
  hideLabel?: boolean
  hint?: string
  error?: string
  suffix?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function Input({
  label,
  hideLabel,
  hint,
  error,
  suffix,
  className,
  id,
  ref,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="min-w-0">
      <label
        htmlFor={inputId}
        className={cn(
          hideLabel ? 'sr-only' : 'mb-1.5 block text-[0.8125rem] font-medium text-muted',
        )}
      >
        {label}
      </label>
      <div
        className={cn(
          'flex h-12 items-center gap-2 rounded-lg border bg-surface px-3.5 transition-colors duration-200',
          'focus-within:border-ink/60 focus-within:ring-2 focus-within:ring-ink/8',
          error ? 'border-danger/60' : 'border-line-strong',
        )}
      >
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-full w-full min-w-0 bg-transparent text-[0.9375rem] font-medium tabular-nums outline-none',
            'placeholder:font-normal placeholder:text-faint',
            className,
          )}
          {...props}
        />
        {suffix && <span className="shrink-0 text-[0.8125rem] text-faint">{suffix}</span>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
