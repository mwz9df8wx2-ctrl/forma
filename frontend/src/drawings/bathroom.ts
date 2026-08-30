import type { FurnitureLayout, FurnitureModule } from './types.ts'

/**
 * Раскладка мебели для ванной.
 *
 * Главное отличие от остальных категорий — мебель подвесная. Это не мода:
 * под подвесной тумбой моют пол, и она не набирает воду нижней кромкой.
 * Отсюда следует всё остальное: цоколя нет, ножек нет, вся нагрузка идёт
 * на навесы, и высота подвеса — размер, который замеряют по месту.
 */

const mm = (metres: number) => Math.round(metres * 1000)

/** Высота нижней кромки тумбы от пола: под ней должна проходить швабра. */
const VANITY_BOTTOM = 350
const VANITY_HEIGHT = 500
const VANITY_DEPTH = 450
/** Раковина накладная: она стоит на тумбе и добавляет свою высоту. */
const BASIN_HEIGHT = 140
/** Зеркальный шкаф мельче тумбы, иначе он бьёт по голове. */
const MIRROR_CABINET_DEPTH = 160
const MIRROR_CABINET_HEIGHT = 700
/** Пенал в ванной узкий: широкому не хватает стены. */
const COLUMN_WIDTH = 400
const COLUMN_DEPTH = 300

export interface BathroomInput {
  room: { width: number; height: number; depth: number }
  /** Габариты композиции в метрах. */
  width: number
  /** Отступ от левой стены, м. */
  offset: number
  facadeLabel: string
}

export function buildBathroomLayout(input: BathroomInput): FurnitureLayout {
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
      // Вся мебель ванной висит: цоколя и ножек здесь нет.
      mounted: extra?.mounted ?? 'wall',
      surface: extra?.surface,
      facade:
        kind === 'shelf' || kind === 'appliance' || extra?.open ? undefined : input.facadeLabel,
    })
  }

  const offset = mm(input.offset)
  const totalWidth = mm(input.width)
  const roomHeight = mm(input.room.height)

  // Пенал ставим, только если после него остаётся место под нормальную тумбу.
  const withColumn = totalWidth >= COLUMN_WIDTH + 700
  const vanityWidth = withColumn ? totalWidth - COLUMN_WIDTH : totalWidth
  const vanityStart = offset

  push(
    'base',
    'Т',
    'Тумба под раковину, ящики',
    vanityStart,
    vanityWidth,
    VANITY_BOTTOM,
    VANITY_HEIGHT,
    VANITY_DEPTH,
    vanityWidth > 700 ? 2 : 1,
    { drawers: true },
  )

  // Раковина накладная. Её модель заказчик выбирает сам, поэтому здесь
  // только габарит: точный вырез размечают по шаблону производителя.
  const basinWidth = Math.min(vanityWidth - 80, 900)
  push(
    'appliance',
    'РК',
    'Раковина накладная',
    vanityStart + (vanityWidth - basinWidth) / 2,
    basinWidth,
    VANITY_BOTTOM + VANITY_HEIGHT,
    BASIN_HEIGHT,
    VANITY_DEPTH - 40,
    0,
    { surface: 'ceramic' },
  )

  // Зеркальный шкаф над раковиной.
  const mirrorBottom = VANITY_BOTTOM + VANITY_HEIGHT + BASIN_HEIGHT + 250
  if (mirrorBottom + MIRROR_CABINET_HEIGHT <= roomHeight - 150) {
    push(
      'upper',
      'ЗШ',
      'Зеркальный шкаф',
      vanityStart,
      vanityWidth,
      mirrorBottom,
      MIRROR_CABINET_HEIGHT,
      MIRROR_CABINET_DEPTH,
      vanityWidth > 700 ? 2 : 1,
      { surface: 'mirror' },
    )
  }

  if (withColumn) {
    const columnStart = offset + totalWidth - COLUMN_WIDTH
    const columnHeight = Math.min(1600, roomHeight - VANITY_BOTTOM - 250)
    push(
      'tall',
      'П',
      'Пенал подвесной',
      columnStart,
      COLUMN_WIDTH,
      VANITY_BOTTOM,
      columnHeight,
      COLUMN_DEPTH,
      1,
    )
  }

  return {
    room: {
      width: mm(input.room.width),
      height: roomHeight,
      depth: mm(input.room.depth),
    },
    category: 'bathroom',
    // Верх тумбы занят раковиной — столешницы как отдельной детали нет.
    hasWorktop: false,
    counter: { height: 0, depth: VANITY_DEPTH, thickness: 0 },
    run: { start: offset, end: offset + totalWidth },
    sideRun: null,
    backsplash: { top: 0 },
    window: null,
    modules,
  }
}
