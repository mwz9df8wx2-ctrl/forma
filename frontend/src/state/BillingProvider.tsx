import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CreditCosts, Wallet } from '@shared/index'
import { fetchCapabilities, type AiCapabilities } from '@/api/server/ai'
import { fetchWallet } from '@/api/server/billing'
import { useSession } from '@/hooks/useSession'
import { BillingContext } from './billing'

/**
 * Кредиты и возможности сервера.
 *
 * Баланс живёт на сервере: здесь только его отражение. Любое решение
 * «хватает или нет» сервер принимает заново при запуске задания — клиентская
 * проверка нужна лишь для того, чтобы не вести пользователя в тупик.
 */
export function BillingProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [costs, setCosts] = useState<CreditCosts | null>(null)
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!session) {
      setWallet(null)
      setCosts(null)
      setCapabilities(null)
      return
    }
    setLoading(true)
    try {
      const [state, caps] = await Promise.all([fetchWallet(), fetchCapabilities()])
      setWallet(state.wallet)
      setCosts(state.costs)
      setCapabilities(caps)
    } catch {
      // Молча: отсутствие связи с сервером не должно ломать экран.
      // Приложение продолжает считать визуализации на устройстве.
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      wallet,
      costs,
      capabilities,
      loading,
      // Тестовый провайдер не считается настоящей генерацией: без ключа
      // сервер отдаёт заглушки, и локальный расчёт даёт лучший результат.
      serverGeneration: Boolean(
        session && capabilities?.generationEnabled && capabilities.demo === false,
      ),
      canAfford: (credits: number) => (wallet ? wallet.available >= credits : false),
      refresh,
    }),
    [wallet, costs, capabilities, loading, session, refresh],
  )

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}
