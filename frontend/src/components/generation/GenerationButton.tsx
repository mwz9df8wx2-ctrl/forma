import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export function GenerationButton({
  onClick,
  disabled,
  loading,
  missing,
  className,
}: {
  onClick: () => void
  disabled: boolean
  loading?: boolean
  missing: string[]
  className?: string
}) {
  const hint =
    missing.length > 0
      ? `Выберите ${missing.slice(0, 2).join(' и ')}`
      : 'Обычно занимает меньше минуты'

  return (
    <div className={cn('w-full', className)}>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<Sparkles />}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
      >
        Создать визуализацию
      </Button>
      <p
        className={cn(
          'mt-2 text-center text-xs',
          missing.length > 0 ? 'text-clay' : 'text-faint',
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
