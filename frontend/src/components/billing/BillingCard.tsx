import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import type { UsageTransaction } from '@shared/index'
import { USAGE_TYPE_LABELS } from '@shared/index'
import { fetchTransactions } from '@/api/server/billing'
import { Badge } from '@/components/ui/Badge'
import { useBilling } from '@/hooks/useBilling'
import { useSession } from '@/hooks/useSession'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Кредиты и история операций.
 *
 * История нужна не для красоты: когда мастер спрашивает «куда делись кредиты»,
 * ответ должен быть в приложении, а не в переписке с поддержкой.
 */
export function BillingCard() {
  const { session } = useSession()
  const { wallet, costs, capabilities } = useBilling()
  const [transactions, setTransactions] = useState<UsageTransaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    fetchTransactions()
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [session])

  if (!session || !wallet) return null

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink">
          <Coins aria-hidden className="size-[18px]" />
          AI-кредиты
        </h2>
        {capabilities?.demo && <Badge tone="neutral">Демо</Badge>}
      </div>

      <p className="mt-4 text-[2rem] leading-none font-semibold tabular-nums text-ink">
        {wallet.available}
      </p>
      <p className="mt-1.5 text-[0.875rem] text-muted">
        {wallet.reserved > 0
          ? `В работе: ${wallet.reserved}`
          : 'Списываются только за генерацию изображений.'}
      </p>

      {costs && (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-faint">
          Черновой просмотр — {costs.preview}, уточнение — {costs.refine}, финальное качество —{' '}
          {costs.final} за вариант. Проекты, расчёты и чертежи бесплатны.
        </p>
      )}

      {wallet.available <= 0 && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-danger">
          AI-кредиты закончились. Проекты, расчёты и чертежи продолжают работать.
        </p>
      )}

      {transactions.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <p className="eyebrow mb-1">История</p>
          <ul className="divide-y divide-line">
            {transactions.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0 truncate text-[0.8125rem] text-muted">
                  {USAGE_TYPE_LABELS[item.type]}
                  <span className="ml-2 text-faint">{formatDate(item.createdAt)}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[0.8125rem] font-medium tabular-nums',
                    item.creditDelta >= 0 ? 'text-success' : 'text-ink',
                  )}
                >
                  {item.creditDelta > 0 ? `+${item.creditDelta}` : item.creditDelta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && transactions.length === 0 && (
        <p className="mt-4 text-[0.8125rem] text-faint">Загружаем историю…</p>
      )}
    </section>
  )
}
