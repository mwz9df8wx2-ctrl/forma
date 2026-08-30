import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useBilling } from '@/hooks/useBilling'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/format'

/** Сколько кредитов спишет один запуск. Столько же считает сервер. */
const VARIANTS_PER_RUN = 3

export function GenerationButton({
  onClick,
  disabled,
  loading,
  missing,
  category = 'kitchen',
  className,
}: {
  onClick: () => void
  disabled: boolean
  loading?: boolean
  missing: string[]
  /** Визуализация пока построена только для кухни. */
  category?: string
  className?: string
}) {
  const { serverGeneration, wallet, costs } = useBilling()
  const cost = serverGeneration && costs ? costs.preview * VARIANTS_PER_RUN : 0
  // Проверку всё равно повторит сервер: здесь она нужна только чтобы не вести
  // пользователя в отказ.
  const noCredits = cost > 0 && wallet !== null && wallet.available < cost

  const hint =
    category !== 'kitchen'
      ? 'Визуализация пока делается только для кухни. Чертежи и смета работают для всех категорий.'
      : missing.length > 0
        ? `Выберите ${missing.slice(0, 2).join(' и ')}`
        : noCredits
          ? 'AI-кредиты закончились. Расчёты и чертежи продолжают работать.'
          : cost > 0
            ? `Спишется ${cost} ${plural(cost, ['AI-кредит', 'AI-кредита', 'AI-кредитов'])} · обычно меньше минуты`
            : 'Обычно занимает меньше минуты'

  return (
    <div className={cn('w-full', className)}>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<Sparkles />}
        onClick={onClick}
        disabled={disabled || noCredits}
        loading={loading}
      >
        Создать визуализацию
      </Button>
      <p
        className={cn(
          'mt-2 text-center text-xs',
          missing.length > 0 || noCredits || category !== 'kitchen' ? 'text-clay' : 'text-faint',
        )}
      >
        {hint}
      </p>
    </div>
  )
}

/** Закреплённая внизу экрана панель действия — основной сценарий на телефоне. */
export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-bottom sticky bottom-0 z-30 -mx-5 mt-8 border-t border-line bg-canvas/92 px-5 pt-3 pb-3 backdrop-blur-md lg:hidden">
      {children}
    </div>
  )
}
