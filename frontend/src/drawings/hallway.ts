import type { FurnitureLayout, FurnitureModule } from './types.ts'

/**
 * Раскладка прихожей.
 *
 * Прихожая почти всегда узкая, поэтому её собирают не из кухонных 600 мм,
 * а из того, что помещается: пенал под верхнюю одежду, открытая вешалка,
 * низкая тумба под обувь и зеркало над ней. Глубина здесь важнее ширины —
 * шкаф в 600 мм в коридоре 1,2 м перекрывает проход.
 */

const mm = (metres: number) => Math.round(metres * 1000)

/** Глубина пенала под плечики: меньше не позволяет ширина вешалки. */
const WARDROBE_DEPTH = 450
/** Открытая вешалка мельче: она без дверцы, одежда висит на крючках. */
const RACK_DEPTH = 300
/** Тумба под обувь: глубже не нужно, обувь стоит поперёк. */
const SHOE_DEPTH = 320

export interface HallwayInput {
  room: { width: number; height: number; depth: number }
  /** Габариты композиции в метрах. */
  width: number
  height: number
  /** Отступ от левой стены, м. */
  offset: number
  facadeLabel: string
}

export function buildHallwayLayout(input: HallwayInput): FurnitureLayout {
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
    extra?: {
      open?: boolean
      drawers?: boolean
      mounted?: 'floor' | 'wall'
      surface?: 'screen' | 'mirror' | 'ceramic'
    },
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
      mounted: extra?.mounted,
      surface: extra?.surface,
      facade:
        kind === 'shelf' || kind === 'appliance' || extra?.open ? undefined : input.facadeLabel,
    })
  }

  const offset = mm(input.offset)
  const totalWidth = mm(input.width)
  const height = mm(input.height)
  const plinth = 80

  // Пенал занимает столько, сколько остаётся после вешалки и тумбы,
  // но не больше разумной ширины створки.
  const wardrobeWidth = Math.min(700, Math.max(400, Math.round(totalWidth * 0.34)))
  const shoeWidth = Math.min(700, Math.max(400, Math.round(totalWidth * 0.28)))
  const rackWidth = totalWidth - wardrobeWidth - shoeWidth

  push('tall', 'П', 'Пенал для верхней одежды', offset, wardrobeWidth, plinth, height - plinth, WARDROBE_DEPTH, wardrobeWidth > 700 ? 2 : 1)
  // Штанга в пенале: по ней сверлят держатели.
  push('shelf', 'ШТ', 'Штанга для плечиков', offset + 20, wardrobeWidth - 40, height - 220, 25, WARDROBE_DEPTH - 60, 0)

  const rackStart = offset + wardrobeWidth
  if (rackWidth >= 400) {
    // Открытая вешалка: дверцы у неё нет, и это производственный факт.
    push('tall', 'В', 'Открытая вешалка', rackStart, rackWidth, plinth, height - plinth, RACK_DEPTH, 0, {
      open: true,
    })
    // Полка над крючками и сама планка с крючками.
    push('shelf', 'ПЛ', 'Полка над вешалкой', rackStart + 16, rackWidth - 32, height - 420, 18, RACK_DEPTH - 40, 0)
    push('shelf', 'КР', 'Планка с крючками', rackStart + 16, rackWidth - 32, height - 700, 40, 60, 0)
  }

  const shoeStart = offset + totalWidth - shoeWidth
  const shoeHeight = 520
  push('base', 'Т', 'Тумба для обуви, ящики', shoeStart, shoeWidth, plinth, shoeHeight - plinth, SHOE_DEPTH, 2, {
    drawers: true,
  })

  // Зеркало над тумбой: в прихожей это не украшение, а то, ради чего
  // к ней подходят. Размер берём по ширине тумбы.
  const mirrorHeight = Math.min(1100, height - shoeHeight - 400)
  if (mirrorHeight > 500) {
    push(
      'appliance',
      'ЗР',
      'Зеркало',
      shoeStart + 40,
      shoeWidth - 80,
      shoeHeight + 220,
      mirrorHeight,
      20,
      0,
      { mounted: 'wall', surface: 'mirror' },
    )
  }

  return {
    room: {
      width: mm(input.room.width),
      height: mm(input.room.height),
      depth: mm(input.room.depth),
    },
    category: 'hallway',
    hasWorktop: false,
    counter: { height: 0, depth: WARDROBE_DEPTH, thickness: 0 },
    run: { start: offset, end: offset + totalWidth },
    sideRun: null,
    backsplash: { top: 0 },
    window: null,
    modules,
  }
}
