import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCatalog } from '@/api'
import { toAppError } from '@/lib/errors'
import type { Catalog } from '@/types'
import { CatalogContext } from './catalog'

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getCatalog()
      .then((result) => {
        if (cancelled) return
        setCatalog(result)
      })
      .catch((cause) => {
        if (cancelled) return
        setError(toAppError(cause).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  const value = useMemo(
    () => ({ catalog, loading, error, reload }),
    [catalog, loading, error, reload],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
