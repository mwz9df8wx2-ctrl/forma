import type { FurnitureLayout, FurnitureModule } from './types.ts'

/**
 * Раскладка стеллажа.
 *
 * Стеллаж — это почти одни полки, поэтому здесь важен единственный расчёт,
 * который его определяет: пролёт полки. ЛДСП 16 мм при пролёте больше 800 мм
 * заметно провисает под книгами за год-два, и заказчик приходит с претензией
 * к цеху, а не к плите. Поэтому ширину секции считаем от допустимого пролёта,
 * а не от «красиво поделить».
 */

const mm = (metres: number) => Math.round(metres * 1000)

/** Допустимый пролёт полки по толщине материала, мм. */
const MAX_SPAN: Record<number, number> = { 16: 800, 18: 900, 22: 1000, 25: 1100 }

/** Шаг полок: ниже неудобно ставить книги, выше пропадает объём. */
const SHELF_PITCH = 350
const PANEL = 18

export interface ShelvingInput {
  room: { width: number; height: number; depth: number }
  /** Габариты изделия в метрах. */
  width: number
  height: number
  depth: number
  /** Отступ от левой стены, м. */
  offset: number
  /** Толщина полки, мм: от неё зависит допустимый пролёт. */
  shelfThicknessMm: number
  /** Закрытый цоколь-тумба снизу: там прячут то, что не показывают. */
  closedBase: boolean
  facadeLabel: string
}

/** Допустимый пролёт для толщины. Незнакомая толщина считается как 16 мм. */
export function maxShelfSpan(thicknessMm: number): number {
  const known = Object.keys(MAX_SPAN)
    .map(Number)
    .filter((value) => value <= thicknessMm)
  if (known.length === 0) return MAX_SPAN[16]
  return MAX_SPAN[Math.max(...known)]
}

export function buildShelvingLayout(input: ShelvingInput): FurnitureLayout {
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
      facade: kind === 'shelf' || extra?.open ? undefined : input.facadeLabel,
    })
  }

  const offset = mm(input.offset)
  const totalWidth = mm(input.width)
  const height = mm(input.height)
  const depth = mm(input.depth)
  const plinth = 80

  // Число секций берём по допустимому пролёту, а не по вкусу: секция шире
  // предела означает провисшую полку через пару лет.
  const span = maxShelfSpan(input.shelfThicknessMm)
  const sections = Math.max(1, Math.ceil((totalWidth - PANEL) / (span + PANEL)))
  const cellWidth = Math.round((totalWidth - PANEL * (sections + 1)) / sections)

  const baseHeight = input.closedBase ? 420 : 0
  const openBottom = plinth + baseHeight
  const openHeight = height - openBottom

  let cursor = offset + PANEL
  for (let index = 0; index < sections; index += 1) {
    // Закрытый низ: одна дверца или два ящика на секцию.
    if (baseHeight > 0) {
      push(
        'base',
        'Т',
        'Нижняя секция закрытая',
        cursor,
        cellWidth,
        plinth,
        baseHeight,
        depth,
        1,
      )
    }

    push('tall', 'С', 'Секция стеллажа', cursor, cellWidth, openBottom, openHeight, depth, 0, {
      open: true,
    })

    // Полки внутри секции. Верхнюю крышку не дублируем.
    let shelfY = openBottom + SHELF_PITCH
    while (shelfY + input.shelfThicknessMm < openBottom + openHeight - 60) {
      push(
        'shelf',
        'ПЛ',
        'Полка стеллажа',
        cursor,
        cellWidth,
        shelfY,
        input.shelfThicknessMm,
        depth - 10,
        0,
      )
      shelfY += SHELF_PITCH
    }

    cursor += cellWidth + PANEL
  }

  return {
    room: {
      width: mm(input.room.width),
      height: mm(input.room.height),
      depth: mm(input.room.depth),
    },
    category: 'shelving',
    hasWorktop: false,
    counter: { height: 0, depth, thickness: 0 },
    run: { start: offset, end: offset + totalWidth },
    sideRun: null,
    backsplash: { top: 0 },
    window: null,
    modules,
  }
}
