import { createContext } from 'react'
import type { Catalog } from '@/types'

export interface CatalogContextValue {
  catalog: Catalog | null
  loading: boolean
  error: string | null
  reload: () => void
}

export const CatalogContext = createContext<CatalogContextValue | null>(null)
