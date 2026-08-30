import { AlertTriangle } from 'lucide-react'
import type { Suggestion } from '@/api/server/measurements'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * Карточка подтверждения.
 *
 * Разбор показывает, что он понял, и фрагмент текста, из которого взял число.
 * Ничего не записывается, пока человек не подтвердил: по этим числам режут
 * материал, и ошибку в 30–50 мм уже не исправить.
 */
export function SuggestionList({
  suggestions,
  selected,
  saving,
  onToggle,
  onApply,
  onDismiss,
}: {
  suggestions: Suggestion[]
  selected: Set<string>
  saving: boolean
  onToggle: (id: string) => void
  onApply: () => void
  onDismiss: () => void
}) {
  const conflicts = suggestions.filter((item) => item.conflict && selected.has(item.id)).length

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[1.0625rem] font-semibold text-ink">Проверьте, что распознано</h2>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
        Значения запишутся только после подтверждения. Рядом — фрагмент, из которого взято число.
      </p>

      <ul className="mt-4 space-y-2">
        {suggestions.map((item) => {
          const checked = selected.has(item.id)
          return (
            <li key={item.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-200',
                  checked ? 'border-ink/40 bg-surface-2' : 'border-line hover:bg-surface-2',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[0.9375rem] font-medium text-ink">{item.label}</span>
                    <span className="text-[0.9375rem] font-semibold tabular-nums text-ink">
                      {item.value} мм
                    </span>
                    {item.current !== null && item.current !== item.value && (
                      <span className="text-[0.8125rem] text-faint">было {item.current} мм</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">
                    «{item.quote}»
                  </span>
                  {item.conflict && (
                    <span className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-clay">
                      <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
                      Это значение уже было замерено. Подтвердите, если меняете.
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {conflicts > 0 && (
        <p className="mt-3 rounded-lg bg-clay-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-clay">
          Вы перезаписываете {conflicts} ранее подтверждённых замера. Прежние значения останутся
          в истории проекта.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={selected.size === 0 || saving}
          loading={saving}
          onClick={onApply}
        >
          Подтвердить {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
        <Button variant="secondary" size="md" fullWidth onClick={onDismiss} disabled={saving}>
          Отмена
        </Button>
      </div>
    </section>
  )
}
