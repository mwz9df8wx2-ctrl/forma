import type { KitchenLayout, KitchenModule } from './types.ts'

export interface ScheduleRow {
  id: string
  label: string
  size: string
  depth: string
  doors: string
  facade: string
}

const KIND_ORDER: Record<KitchenModule['kind'], number> = {
  base: 0,
  upper: 1,
  tall: 2,
  island: 3,
  shelf: 4,
  appliance: 5,
}

/** Спецификация модулей — то, что уходит в заказ и на раскрой. */
export function buildSchedule(layout: KitchenLayout): ScheduleRow[] {
  return [...layout.modules]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.x - b.x)
    .map((module) => ({
      id: module.id,
      label: module.label,
      size: `${module.width} × ${module.height}`,
      depth: `${module.depth}`,
      doors: module.doors > 0 ? String(module.doors) : '—',
      facade: module.facade ?? '—',
    }))
}

/** Короткая сводка по объёму: сколько модулей и погонных метров. */
export function summarize(layout: KitchenLayout): {
  modules: number
  frontMetres: number
  facadeArea: number
} {
  const counted = layout.modules.filter((module) => module.kind !== 'appliance')
  const facadeArea = counted.reduce(
    (sum, module) => sum + (module.width * module.height) / 1_000_000,
    0,
  )
  return {
    modules: counted.length,
    frontMetres: (layout.run.end - layout.run.start) / 1000,
    facadeArea: Math.round(facadeArea * 100) / 100,
  }
}
