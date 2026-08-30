import { splitRun } from './layout.ts'
import type { FurnitureLayout, FurnitureModule } from './types.ts'

/**
 * Раскладка шкафа и тумбы.
 *
 * Собирается в ту же структуру, что и кухня. Это не экономия строк: чертежи,
 * спецификация, расчёт крепежа и смета уже умеют работать с FurnitureLayout,
 * и второй параллельный набор правил рано или поздно разошёлся бы с первым —
 * а расходятся такие вещи в цеху, на раскрое.
 */

const mm = (metres: number) => Math.round(metres * 1000)

/** Шаг полок в мм: ниже неудобно складывать, выше пустует. */
const SHELF_PITCH = 380
/** Высота ящика вместе с зазором. */
const DRAWER_HEIGHT = 180

export interface WardrobeInput {
  room: { width: number; height: number; depth: number }
  /** Габариты изделия в метрах. */
  width: number
  height: number
  depth: number
  /** Отступ от левой стены, м. */
  offset: number
  /** Сколько секций отдано под штангу для одежды. */
  hangingSections: number
  /** Блок ящиков в первой секции. */
  drawers: number
  /** Антресоль сверху отдельными дверцами. */
  topBox: boolean
  facadeLabel: string
  category: 'wardrobe' | 'cabinet'
}

export function buildWardrobeLayout(input: WardrobeInput): FurnitureLayout {
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
    internal?: boolean,
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
      internal,
      facade: kind === 'shelf' ? undefined : input.facadeLabel,
    })
  }

  const plinth = 100
  const offset = mm(input.offset)
  const totalWidth = mm(input.width)
  const totalHeight = mm(input.height)
  const depth = mm(input.depth)

  // Антресоль отделяется горизонтальной перегородкой: её дверцы короче,
  // и петли на них считаются отдельно.
  const topBoxHeight = input.topBox && totalHeight > 2200 ? 500 : 0
  const bodyHeight = totalHeight - topBoxHeight - plinth

  const widths = splitRun(totalWidth, 600, 300)
  let cursor = offset
  // Ящики ставим в первую секцию без штанги: под одеждой им мешает подол.
  let drawersPlaced = input.drawers <= 0

  widths.forEach((width, index) => {
    const hanging = index < input.hangingSections
    push(
      'tall',
      'Ш',
      hanging ? 'Секция со штангой' : 'Секция с полками',
      cursor,
      width,
      plinth,
      bodyHeight,
      depth,
      width > 700 ? 2 : 1,
    )

    if (hanging) {
      // Штанга — покупная деталь, но её положение нужно на чертеже:
      // по нему сверлят держатели.
      push('shelf', 'ШТ', 'Штанга для одежды', cursor + 20, width - 40, plinth + bodyHeight - 120, 25, depth - 60, 0)
      // Над штангой одна полка для сезонных вещей.
      push('shelf', 'П', 'Полка секции', cursor + 16, width - 32, plinth + bodyHeight - 420, 16, depth - 40, 0)
    } else if (!drawersPlaced) {
      drawersPlaced = true
      const blockHeight = input.drawers * DRAWER_HEIGHT
      // Блок стоит внутри секции: ножек и цоколя у него нет.
      push('base', 'Я', 'Блок ящиков', cursor + 16, width - 32, plinth, blockHeight, depth - 60, input.drawers, true)
      let shelfY = plinth + blockHeight + SHELF_PITCH
      while (shelfY < plinth + bodyHeight - 120) {
        push('shelf', 'П', 'Полка секции', cursor + 16, width - 32, shelfY, 16, depth - 40, 0)
        shelfY += SHELF_PITCH
      }
    } else {
      let shelfY = plinth + SHELF_PITCH
      while (shelfY < plinth + bodyHeight - 120) {
        push('shelf', 'П', 'Полка секции', cursor + 16, width - 32, shelfY, 16, depth - 40, 0)
        shelfY += SHELF_PITCH
      }
    }

    if (topBoxHeight > 0) {
      push(
        'upper',
        'А',
        'Антресоль',
        cursor,
        width,
        plinth + bodyHeight,
        topBoxHeight,
        depth,
        width > 700 ? 2 : 1,
      )
    }

    cursor += width
  })

  return {
    room: {
      width: mm(input.room.width),
      height: mm(input.room.height),
      depth: mm(input.room.depth),
    },
    category: input.category,
    // У шкафа столешницы нет: лист «Схема столешниц» для него не выпускается.
    hasWorktop: false,
    counter: { height: 0, depth: depth, thickness: 0 },
    run: { start: offset, end: offset + totalWidth },
    sideRun: null,
    backsplash: { top: 0 },
    window: null,
    modules,
  }
}
