import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'quiet'
  | 'danger'
  | 'light'
  | 'outlineLight'
  | 'onDark'
  | 'overlay'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  icon?: ReactNode
  iconEnd?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-white border border-ink hover:bg-graphite hover:border-graphite active:bg-ink disabled:border-line disabled:bg-surface-3 disabled:text-muted',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink/45 hover:bg-surface-2 active:bg-surface-3 disabled:text-faint disabled:border-line',
  ghost:
    'bg-transparent text-ink border border-transparent hover:bg-ink/5 active:bg-ink/8 disabled:text-faint',
  quiet:
    'bg-surface-3 text-graphite border border-transparent hover:bg-line active:bg-line-strong disabled:text-faint',
  danger:
    'bg-danger-soft text-danger border border-danger/25 hover:bg-danger hover:text-white active:bg-danger disabled:text-faint',
  // Варианты для тёмных экранов: камера, подтверждение снимка, просмотр результата.
  light:
    'bg-white text-ink border border-white hover:bg-[#EFEDE8] hover:border-[#EFEDE8] active:bg-[#E7E3DB] disabled:bg-white/50 disabled:text-ink/40',
  outlineLight:
    'bg-transparent text-white border border-white/25 hover:border-white/55 hover:bg-white/10 active:bg-white/15 disabled:text-white/40',
  onDark:
    'bg-white/10 text-white border border-transparent hover:bg-white/20 active:bg-white/25 disabled:text-white/35',
  overlay:
    'bg-surface/92 text-graphite border border-line backdrop-blur-sm hover:bg-surface hover:text-ink active:bg-surface-3',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-11 px-3.5 text-[0.8125rem] gap-1.5 rounded-lg',
  md: 'h-12 px-5 text-[0.9375rem] gap-2 rounded-lg',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-xl',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  loading,
  icon,
  iconEnd,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium tracking-[-0.01em]',
        'transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
        'active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden className="size-[1.15em] shrink-0 animate-spin" />
      ) : (
        icon && <span className="shrink-0 [&_svg]:size-[1.15em]">{icon}</span>
      )}
      <span className="truncate">{children}</span>
      {iconEnd && !loading && <span className="shrink-0 [&_svg]:size-[1.15em]">{iconEnd}</span>}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  ref?: Ref<HTMLButtonElement>
}

const ICON_SIZES = {
  sm: 'size-11',
  md: 'size-12',
  lg: 'size-14',
}

/** Кнопка-иконка. label обязателен — без него элемент недоступен со скринридера. */
export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  type = 'button',
  ref,
  ...props
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        ICON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
