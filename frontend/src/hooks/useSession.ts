import { useContext } from 'react'
import { SessionContext } from '@/state/session'

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession используется вне SessionProvider')
  return context
}
