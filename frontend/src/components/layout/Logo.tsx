import { cn } from '@/lib/cn'

/** Знак — L-образная планировка кухни в плане. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-ink text-white',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        <path d="M4.5 19.5V4.5h5v10h10v5z" fill="currentColor" />
        <path d="M13 4.5h6.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
      </svg>
    </span>
  )
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[0.9375rem] font-semibold tracking-[0.22em] text-ink">ФОРМА</span>
          <span className="mt-1 text-[0.625rem] tracking-[0.1em] text-faint uppercase">
            Визуализация кухонь
          </span>
        </span>
      )}
    </span>
  )
}
