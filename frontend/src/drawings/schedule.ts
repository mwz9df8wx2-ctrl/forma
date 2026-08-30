import type { FurnitureLayout, FurnitureModule } from './types.ts'

export interface ScheduleRow {
  id: string
  label: string
  size: string
  depth: string
  doors: string
  facade: string
  /** У какой стены стоит модуль: в угловой кухне это не праздный вопрос. */
  wall: string
}

const KIND_ORDER: Record<FurnitureModule['kind'], number> = {
  base: 0,
  upper: 1,
  tall: 2,
  island: 3,
  shelf: 4,
  appliance: 5,
}

/** Спецификация модулей — то, что уходит в заказ и на раскрой. */
export function buildSchedule(layout: FurnitureLayout): ScheduleRow[] {
  return [...layout.modules]
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        Number(a.wall === 'side') - Number(b.wall === 'side') ||
        a.x - b.x,
    )
    .map((module) => ({
      id: module.id,
      label: module.label,
      size: `${module.width} × ${module.height}`,
      depth: `${module.depth}`,
      doors: module.doors > 0 ? String(module.doors) : '—',
      facade: module.facade ?? '—',
      wall: module.wall === 'side' ? 'боковая' : 'основная',
    }))
}

/** Короткая сводка по объёму: сколько модулей и погонных метров. */
export function summarize(layout: FurnitureLayout): {
  modules: number
  frontMetres: number
  facadeArea: number
} {
  const counted = layout.modules.filter((module) => module.kind !== 'appliance')
  const sideMetres = layout.sideRun ? (layout.sideRun.end - layout.sideRun.start) / 1000 : 0
  const facadeArea = counted.reduce(
    (sum, module) => sum + (module.width * module.height) / 1_000_000,
    0,
  )
  return {
    modules: counted.length,
    // Фронт угловой кухни — сумма обоих рядов: по нему считают столешницу.
    frontMetres: (layout.run.end - layout.run.start) / 1000 + sideMetres,
    facadeArea: Math.round(facadeArea * 100) / 100,
  }
}
