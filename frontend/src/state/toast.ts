import { createContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

export interface ToastContextValue {
  toasts: ToastMessage[]
  show: (toast: Omit<ToastMessage, 'id'>) => void
  showError: (error: unknown) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
