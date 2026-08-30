import {
  measurementChecklist,
  parseMeasurements,
  type Appliance,
  type MeasurementSuggestion,
  type ProjectSpec,
  type Utility,
  type ValueStatus,
} from '../../../shared/src/index.ts'

/**
 * Применение замеров к спецификации.
 *
 * Ничего не применяется само. Разбор только предлагает, человек подтверждает.
 * Причина в одной фразе заказчика: ошибка даже в 30–50 мм делает столешницу
 * непригодной — её уже отпилили по этому числу.
 */

const APPLIANCE_INSTALLATION: Record<Appliance['slot'], Appliance['installation']> = {
  hob: 'built_in',
  oven: 'built_in',
  dishwasher: 'built_in',
  fridge: 'freestanding',
  microwave: 'built_in',
  hood: 'built_in',
  sink: 'built_in',
}

export interface DescribedSuggestion extends MeasurementSuggestion {
  label: string
  /** Что записано в спецификации сейчас. */
  current: number | null
  currentStatus: ValueStatus
  /** Значение уже подтверждено и не совпадает с новым — решает человек. */
  conflict: boolean
}

export function describeSuggestions(
  spec: ProjectSpec,
  suggestions: MeasurementSuggestion[],
): DescribedSuggestion[] {
  const items = new Map(measurementChecklist(spec).map((item) => [item.id, item]))
  const described: DescribedSuggestion[] = []

  for (const suggestion of suggestions) {
    const item = items.get(suggestion.id)
    if (!item) continue
    described.push({
      ...suggestion,
      label: item.label,
      current: item.value,
      currentStatus: item.status,
      conflict:
        item.status === 'confirmed' && item.value !== null && item.value !== suggestion.value,
    })
  }

  return described
}

export function suggestFromText(spec: ProjectSpec, text: string): DescribedSuggestion[] {
  return describeSuggestions(spec, parseMeasurements(text, measurementChecklist(spec)))
}

export interface AcceptedMeasurement {
  id: string
  value: number
}

/**
 * Запись подтверждённых значений.
 * Статус становится «замер»: дальше по этому числу пилят.
 */
export function applyMeasurements(spec: ProjectSpec, accepted: AcceptedMeasurement[]): ProjectSpec {
  const next: ProjectSpec = {
    ...spec,
    dimensions: { ...spec.dimensions },
    dimensionStatus: { ...spec.dimensionStatus },
    appliances: spec.appliances.map((item) => ({ ...item })),
    utilities: spec.utilities.map((item) => ({ ...item })),
  }

  const items = new Map(measurementChecklist(spec).map((item) => [item.id, item]))

  for (const entry of accepted) {
    const limit = items.get(entry.id)
    // Значение вне диапазона не пишем: опечатка на порядок уходит в цех молча.
    if (limit && (entry.value < limit.min || entry.value > limit.max)) continue

    if (entry.id.startsWith('appliance:')) {
      const slot = entry.id.slice('appliance:'.length) as Appliance['slot']
      const existing = next.appliances.find((item) => item.slot === slot)
      if (existing) {
        existing.widthMm = entry.value
        existing.status = 'confirmed'
      } else {
        next.appliances.push({
          slot,
          widthMm: entry.value,
          model: null,
          installation: APPLIANCE_INSTALLATION[slot] ?? 'built_in',
          status: 'confirmed',
        })
      }
      continue
    }

    if (entry.id.startsWith('utility:')) {
      const kind = entry.id.slice('utility:'.length) as Utility['kind']
      const existing = next.utilities.find((item) => item.kind === kind)
      if (existing) {
        existing.offsetMm = entry.value
        existing.status = 'confirmed'
      } else {
        next.utilities.push({
          kind,
          wall: 'main',
          offsetMm: entry.value,
          // Высоту подключения замеряют отдельно — здесь она ещё неизвестна.
          heightMm: 0,
          status: 'confirmed',
        })
      }
      continue
    }

    if (entry.id in next.dimensions) {
      const key = entry.id as keyof ProjectSpec['dimensions']
      next.dimensions[key] = entry.value
      next.dimensionStatus[key] = 'confirmed'
    }
  }

  return next
}
