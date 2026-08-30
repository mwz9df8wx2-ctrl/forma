import { Coins } from 'lucide-react'
import { useBilling } from '@/hooks/useBilling'
import { cn } from '@/lib/cn'

/** Остаток кредитов. Показывается только вошедшим — без сервера кредитов нет. */
export function CreditsCard({ className }: { className?: string }) {
  const { wallet, capabilities } = useBilling()
  if (!wallet) return null

  const empty = wallet.available <= 0

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        empty ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface-2',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink">
          <Coins aria-hidden className="size-4" />
          AI-кредиты
        </span>
        <span
          className={cn(
            'text-[1.0625rem] leading-none font-semibold tabular-nums',
            empty ? 'text-danger' : 'text-ink',
          )}
        >
          {wallet.available}
        </span>
      </div>

      {wallet.reserved > 0 && (
        <p className="mt-1.5 text-xs text-muted">В работе: {wallet.reserved}</p>
      )}

      {empty && (
        <p className="mt-1.5 text-xs leading-snug text-muted">
          Проекты, расчёты и чертежи продолжают работать.
        </p>
      )}

      {capabilities?.demo && (
        <p className="mt-1.5 text-xs leading-snug text-muted">
          Провайдер не подключён — изображения считаются на устройстве, кредиты не тратятся.
        </p>
      )}
    </div>
  )
}
