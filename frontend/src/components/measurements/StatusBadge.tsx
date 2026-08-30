import type { MeasurementItem } from '@shared/index'
import { VALUE_STATUS_LABELS } from '@shared/index'
import { cn } from '@/lib/cn'

/**
 * Статус значения.
 *
 * Отличать замер от предположения важнее, чем показать само число:
 * по предположению нельзя резать материал.
 */
const TONES: Record<MeasurementItem['status'], string> = {
  confirmed: 'bg-success/12 text-success',
  derived: 'bg-surface-3 text-graphite',
  estimated: 'bg-clay-soft text-clay',
  missing: 'bg-danger-soft text-danger',
}

export function StatusBadge({ status }: { status: MeasurementItem['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-[0.04em] uppercase',
        TONES[status],
      )}
    >
      {VALUE_STATUS_LABELS[status]}
    </span>
  )
}
