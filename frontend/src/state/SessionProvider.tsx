import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadSession, serverAvailable, type Session } from '@/api/server/client'
import { login, logout, register } from '@/api/server/auth'
import { SessionContext } from './session'

/**
 * Сессия пользователя.
 *
 * Вход необязателен: без сервера приложение продолжает работать локально —
 * замерщик не должен остаться без инструмента там, где нет связи.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [serverOnline, setServerOnline] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    serverAvailable()
      .then((online) => {
        if (!cancelled) setServerOnline(online)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setSession(await login(email, password))
    setServerOnline(true)
  }, [])

  const signUp = useCallback(
    async (input: { companyName: string; name: string; email: string; password: string }) => {
      setSession(await register(input))
      setServerOnline(true)
    },
    [],
  )

  const signOut = useCallback(async () => {
    await logout()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, serverOnline, checking, signIn, signUp, signOut }),
    [session, serverOnline, checking, signIn, signUp, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
