import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastViewport } from '@/components/ui/Toast'
import { createId } from '@/lib/id'
import { toAppError } from '@/lib/errors'
import { ToastContext, type ToastMessage } from './toast'

const AUTO_DISMISS = 5200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = createId('toast')
      setToasts((current) => [...current.slice(-2), { ...toast, id }])
      setTimeout(() => dismiss(id), AUTO_DISMISS)
    },
    [dismiss],
  )

  const showError = useCallback(
    (error: unknown) => {
      // Пользователю показываем только человеческий текст, без стека вызовов.
      show({ title: toAppError(error).message, variant: 'error' })
    },
    [show],
  )

  const value = useMemo(
    () => ({ toasts, show, showError, dismiss }),
    [toasts, show, showError, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
