import { useContext } from 'react'
import { BillingContext } from '@/state/billing'

export function useBilling() {
  const context = useContext(BillingContext)
  if (!context) throw new Error('useBilling используется вне BillingProvider')
  return context
}
