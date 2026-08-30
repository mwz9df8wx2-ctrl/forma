import { useContext } from 'react'
import { CatalogContext } from '@/state/catalog'

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog используется вне CatalogProvider')
  return context
}
