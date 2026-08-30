import { ChefHat, LayoutPanelTop, Monitor, Package, Shirt } from 'lucide-react'
import type { FurnitureCategory } from '@shared/index'
import { cn } from '@/lib/cn'

/**
 * Что проектируем.
 *
 * Категория меняет раскладку, состав листов техпакета и смету, поэтому она
 * стоит первой: выбирать фасады раньше, чем понятно, для чего они, бессмысленно.
 */

const OPTIONS: Array<{
  id: FurnitureCategory
  name: string
  caption: string
  icon: typeof ChefHat
}> = [
  { id: 'kitchen', name: 'Кухня', caption: 'Нижний и верхний ярус, столешница', icon: ChefHat },
  { id: 'wardrobe', name: 'Шкаф', caption: 'Секции, полки, штанга, антресоль', icon: Shirt },
  { id: 'cabinet', name: 'Тумба', caption: 'Низкий объём с полками и ящиками', icon: Package },
  { id: 'tv_zone', name: 'ТВ-зона', caption: 'Тумба под телевизор и навесные полки', icon: Monitor },
  {
    id: 'living_room',
    name: 'Стенка в гостиную',
    caption: 'Пеналы по краям, тумба под ТВ, полки',
    icon: LayoutPanelTop,
  },
]

export function CategorySelector({
  value,
  onChange,
}: {
  value: FurnitureCategory
  onChange: (value: FurnitureCategory) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Что проектируем"
      className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
    >
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
              'flex min-h-[88px] flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors duration-200',
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
