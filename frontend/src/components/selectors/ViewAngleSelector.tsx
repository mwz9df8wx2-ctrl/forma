import { Camera, CornerDownLeft, CornerDownRight, Square } from 'lucide-react'
import type { ProjectParams } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Ракурс съёмки.
 *
 * По умолчанию три варианта показывают изделие с трёх сторон — так заказчик
 * видит и фронт, и глубину. Выбранный ракурс нужен, когда клиенту важен
 * один конкретный вид: тогда все варианты снимаются с него.
 */

type Angle = ProjectParams['viewAngle']

const OPTIONS: Array<{ id: Angle; name: string; caption: string; icon: typeof Camera }> = [
  { id: 'auto', name: 'Три ракурса', caption: 'Фронт и две четверти', icon: Camera },
  { id: 'front', name: 'Фронтально', caption: 'Вид прямо на изделие', icon: Square },
  { id: 'left', name: 'Слева', caption: 'Три четверти слева', icon: CornerDownLeft },
  { id: 'right', name: 'Справа', caption: 'Три четверти справа', icon: CornerDownRight },
]

export function ViewAngleSelector({
  value,
  onChange,
}: {
  value: Angle
  onChange: (value: Angle) => void
}) {
  return (
    <div role="radiogroup" aria-label="Ракурс съёмки" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {OPTIONS.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex min-h-[76px] flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors duration-200',
              active
                ? 'border-ink/40 bg-surface-2 shadow-hair'
                : 'border-line bg-surface hover:bg-surface-2',
            )}
          >
            <option.icon aria-hidden className="size-[18px] text-ink" />
            <span className="text-[0.9375rem] font-medium text-ink">{option.name}</span>
            <span className="text-[0.8125rem] leading-snug text-muted">{option.caption}</span>
          </button>
        )
      })}
    </div>
  )
}
