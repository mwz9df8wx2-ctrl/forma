import { splitRun } from './layout.ts'
import type { FurnitureLayout, FurnitureModule } from './types.ts'

/**
 * Раскладка ТВ-зоны и стенки в гостиную.
 *
 * Обе собираются в ту же структуру, что кухня и шкаф: чертежи, спецификация,
 * расчёт крепежа и смета уже умеют с ней работать. Разница между ними —
 * только в составе: у ТВ-зоны нижняя тумба и полка, у стенки к ним добавляются
 * пеналы по краям.
 *
 * Телевизор попадает в раскладку как техника: его не изготавливают, но от его
 * габарита зависят и высота подвеса, и свободная ниша между полками.
 */

const mm = (metres: number) => Math.round(metres * 1000)

/** Пропорция телевизора 16:9 — по ней считается высота ниши. */
const TV_ASPECT = 9 / 16
/** Просвет вокруг телевизора: кабели, кронштейн и запас на другую модель. */
const TV_CLEARANCE = 80

export interface LivingRoomInput {
  room: { width: number; height: number; depth: number }
  /** Габариты композиции в метрах. */
  width: number
  depth: number
  /** Отступ от левой стены, м. */
  offset: number
  /** Диагональ телевизора по ширине корпуса, м. */
  tvWidth: number
  /** Высота нижней кромки телевизора от пола, м. */
  tvBottom: number
  category: 'tv_zone' | 'living_room'
  facadeLabel: string
}

export function buildLivingRoomLayout(input: LivingRoomInput): FurnitureLayout {
  const modules: FurnitureModule[] = []
  const counters: Record<string, number> = {}

  const push = (
    kind: FurnitureModule['kind'],
    prefix: string,
    label: string,
    x: number,
    width: number,
    y: number,
    height: number,
    depth: number,
    doors: number,
    extra?: { open?: boolean; drawers?: boolean },
  ) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    modules.push({
      id: `${prefix}${counters[prefix]}`,
      kind,
      label,
      wall: 'main',
      x: Math.round(x),
      width: Math.round(width),
      y: Math.round(y),
      height: Math.round(height),
      depth: Math.round(depth),
      doors,
      open: extra?.open,
      drawers: extra?.drawers,
      facade: kind === 'shelf' || kind === 'appliance' || extra?.open ? undefined : input.facadeLabel,
    })
  }

  const offset = mm(input.offset)
  const totalWidth = mm(input.width)
  const depth = mm(input.depth)
  const roomHeight = mm(input.room.height)
  const plinth = 80

  const baseHeight = 450
  const baseDepth = depth
  const columnWidth = 600
  const columnHeight = Math.min(2200, roomHeight - 200)

  const withColumns = input.category === 'living_room' && totalWidth > columnWidth * 2 + 900
  const centreStart = withColumns ? offset + columnWidth : offset
  const centreEnd = withColumns ? offset + totalWidth - columnWidth : offset + totalWidth
  const centreWidth = centreEnd - centreStart

  // Пеналы по краям: в них уходит основное хранение стенки.
  if (withColumns) {
    for (const [index, start] of [offset, offset + totalWidth - columnWidth].entries()) {
      push(
        'tall',
        'П',
        index === 0 ? 'Пенал левый' : 'Пенал правый',
        start,
        columnWidth,
        plinth,
        columnHeight - plinth,
        depth,
        2,
      )
    }
  }

  // Нижняя тумба под телевизором.
  let cursor = centreStart
  for (const width of splitRun(centreWidth, 600)) {
    // Под телевизором ящики удобнее дверец: до задней стенки не дотянуться,
    // а провода и мелочь достают каждый день.
    push(
      'base',
      'Т',
      'Тумба под ТВ, ящики',
      cursor,
      width,
      plinth,
      baseHeight - plinth,
      baseDepth,
      width > 500 ? 2 : 1,
      { drawers: true },
    )
    cursor += width
  }

  // Телевизор. Ширину и высоту подвеса задаёт заказчик, а не расчёт:
  // менять их по своему усмотрению нельзя — кронштейн уже куплен.
  const tvWidth = Math.min(mm(input.tvWidth), centreWidth - 100)
  const tvHeight = Math.round(tvWidth * TV_ASPECT)
  const tvBottom = Math.max(baseHeight + 120, mm(input.tvBottom))
  const tvX = centreStart + (centreWidth - tvWidth) / 2
  push('appliance', 'ТВ', 'Телевизор', tvX, tvWidth, tvBottom, tvHeight, 60, 0)

  // Полки над телевизором. Ставим только те, что помещаются с просветом:
  // полка вплотную к экрану мешает и кронштейну, и вентиляции.
  const shelfTop = withColumns ? columnHeight : Math.min(roomHeight - 400, tvBottom + tvHeight + 900)
  let shelfY = tvBottom + tvHeight + TV_CLEARANCE + 220
  let shelves = 0
  while (shelfY + 18 <= shelfTop && shelves < 2) {
    push('shelf', 'ПЛ', 'Полка навесная', centreStart + 20, centreWidth - 40, shelfY, 18, 260, 0)
    shelfY += 340
    shelves += 1
  }

  return {
    room: {
      width: mm(input.room.width),
      height: roomHeight,
      depth: mm(input.room.depth),
    },
    category: input.category,
    // Столешницы у гостиной нет: верх тумбы — это крышка корпуса.
    hasWorktop: false,
    counter: { height: 0, depth, thickness: 0 },
    run: { start: offset, end: offset + totalWidth },
    sideRun: null,
    backsplash: { top: 0 },
    window: null,
    modules: modules.filter((module) => module.height > 0),
  }
}
