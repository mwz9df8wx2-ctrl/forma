import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { MeasurementItem } from '@shared/index'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from './StatusBadge'

/** Одна строка листа замеров: значение, статус и ручной ввод. */
export function ChecklistRow({
  item,
  saving,
  onSave,
}: {
  item: MeasurementItem
  saving: boolean
  onSave: (value: number) => void
}) {
  const [draft, setDraft] = useState(item.value ? String(item.value) : '')

  // Значение могло измениться из разбора текста — поле не должно отставать.
  useEffect(() => {
    setDraft(item.value ? String(item.value) : '')
  }, [item.value])

  const parsed = Number(draft)
  const valid = draft !== '' && Number.isFinite(parsed) && parsed >= item.min && parsed <= item.max
  const changed = valid && parsed !== item.value

  return (
    <div className="flex flex-col gap-2.5 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 sm:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.9375rem] font-medium text-ink">{item.label}</span>
          <StatusBadge status={item.status} />
          {item.required && item.status === 'missing' && (
            <span className="text-xs text-danger">обязательно</span>
          )}
        </div>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{item.reason}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="w-32 shrink-0">
          <Input
            label={`${item.label}, мм`}
            hideLabel
            suffix="мм"
            type="number"
            inputMode="numeric"
            value={draft}
            min={item.min}
            max={item.max}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Check />}
          disabled={!changed || saving}
          onClick={() => onSave(parsed)}
        >
          Записать
        </Button>
      </div>
    </div>
  )
}
