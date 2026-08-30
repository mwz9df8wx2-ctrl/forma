import { createContext } from 'react'
import type { Session } from '@/api/server/client'

export interface SessionContextValue {
  session: Session | null
  /** Отвечает ли сервер. Приложение работает и без него. */
  serverOnline: boolean
  checking: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    companyName: string
    name: string
    email: string
    password: string
  }) => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
