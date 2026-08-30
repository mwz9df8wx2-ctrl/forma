import { createContext } from 'react'
import type { CreditCosts, Wallet } from '@shared/index'
import type { AiCapabilities } from '@/api/server/ai'

export interface BillingContextValue {
  wallet: Wallet | null
  costs: CreditCosts | null
  capabilities: AiCapabilities | null
  loading: boolean
  /** Считает ли изображения сервер. Иначе визуализация строится на устройстве. */
  serverGeneration: boolean
  /** Хватает ли кредитов на запуск указанной стоимости. */
  canAfford: (credits: number) => boolean
  refresh: () => Promise<void>
}

export const BillingContext = createContext<BillingContextValue | null>(null)
