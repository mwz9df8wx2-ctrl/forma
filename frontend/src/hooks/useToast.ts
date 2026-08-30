import { useContext } from 'react'
import { ToastContext } from '@/state/toast'

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast используется вне ToastProvider')
  return context
}
