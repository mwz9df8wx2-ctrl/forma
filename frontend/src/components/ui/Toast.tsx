import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ToastMessage } from '@/state/toast'

const ICONS = {
  info: Info,
  success: CircleCheck,
  error: CircleAlert,
}

const TONES = {
  info: 'text-graphite',
  success: 'text-success',
  error: 'text-danger',
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Уведомления"
      className="safe-top pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-3 sm:items-end sm:px-6 sm:pt-5"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.variant]
        return (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lift"
          >
            <Icon aria-hidden className={cn('mt-0.5 size-[18px] shrink-0', TONES[toast.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] leading-snug font-medium text-ink">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-snug text-muted">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Закрыть уведомление"
              onClick={() => onDismiss(toast.id)}
              className="-my-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
