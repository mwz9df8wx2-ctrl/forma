import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

function useDialogBehaviour(
  open: boolean,
  onClose: () => void,
  panel: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    panel.current?.focus({ preventScroll: true })

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose, panel])
}

function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  variant,
}: DialogProps & { variant: 'modal' | 'sheet' }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogBehaviour(open, onClose, panelRef)

  if (!open) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        variant === 'modal' ? 'items-center justify-center p-4' : 'items-end justify-center',
      )}
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/35 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[88dvh] w-full flex-col bg-surface shadow-lift outline-none',
          variant === 'modal'
            ? 'max-w-md animate-rise-in rounded-2xl'
            : 'safe-bottom animate-sheet-in rounded-t-2xl sm:max-w-lg sm:rounded-2xl',
          className,
        )}
      >
        {variant === 'sheet' && (
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" />
        )}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-semibold tracking-[-0.015em] text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-[0.8125rem] text-muted">{description}</p>}
          </div>
          <IconButton label="Закрыть" size="sm" onClick={onClose} className="-mt-1 -mr-1.5">
            <X className="size-5" />
          </IconButton>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">{children}</div>}
        {footer && <div className="flex gap-2.5 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Диалог по центру экрана — для подтверждений и коротких форм. */
export function Modal(props: DialogProps) {
  return <DialogShell {...props} variant="modal" />
}

/** Нижняя шторка — основной способ показать детали на телефоне. */
export function Sheet(props: DialogProps) {
  return <DialogShell {...props} variant="sheet" />
}
