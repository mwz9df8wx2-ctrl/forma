import { HARDWARE_RULES } from './hardware.ts'
import { INK, THIN, dimensionH, dimensionV, line, rect, svgDocument, text } from './svg.ts'
import type { KitchenLayout } from './types.ts'

/**
 * Схема столешниц: детали в плане, вырезы, стык и стяжки.
 *
 * Точный размер выреза зависит от конкретной модели техники. Пока модель не
 * подтверждена, размер помечается как предварительный — так же, как это делает
 * любой нормальный конструктор.
 */

export type ValueStatus = 'confirmed' | 'derived' | 'estimated' | 'missing'

export interface WorktopCutout {
  label: string
  /** Отступ центра выреза от левого края детали, мм. */
  centre: number
  width: number
  depth: number
  status: ValueStatus
  note?: string
}

export interface WorktopPart {
  id: string
  label: string
  length: number
  depth: number
  thickness: number
  cutouts: WorktopCutout[]
}

export interface WorktopPlan {
  parts: WorktopPart[]
  /** Число стыков под 90°. */
  joints: number
  boltsPerJoint: number
  boltSize: string
  /** Пристеночный зазор, мм. */
  wallGap: number
  edgeFront: string
  edgeVisible: string
  notes: string[]
}

const HOB_CUTOUT = { width: 560, depth: 490 }
const SINK_CUTOUT = { width: 480, depth: 430 }

export function buildWorktopPlan(layout: KitchenLayout): WorktopPlan {
  const thickness = layout.counter.thickness
  const depth = layout.counter.depth
  const length = layout.run.end - layout.run.start

  const hob = layout.modules.find((module) => module.label === 'Варочная панель')
  const sink = layout.modules.find((module) => module.label === 'Мойка')

  const cutouts: WorktopCutout[] = []
  if (hob) {
    cutouts.push({
      label: 'Вырез под варочную панель',
      centre: hob.x + hob.width / 2 - layout.run.start,
      width: HOB_CUTOUT.width,
      depth: HOB_CUTOUT.depth,
      status: 'estimated',
      note: 'предварительно для панели 600 мм; уточнить по монтажной карте производителя',
    })
  }
  if (sink) {
    cutouts.push({
      label: 'Вырез под мойку',
      centre: sink.x + sink.width / 2 - layout.run.start,
      width: SINK_CUTOUT.width,
      depth: SINK_CUTOUT.depth,
      status: 'estimated',
      note: 'предварительно для мойки 500 мм; уточнить по шаблону мойки',
    })
  }

  return {
    parts: [
      {
        id: 'C1',
        label: 'Деталь C1 — основной фронт',
        length,
        depth,
        thickness,
        cutouts,
      },
    ],
    joints: 0,
    boltsPerJoint: HARDWARE_RULES.worktopBoltsPerJoint,
    boltSize: HARDWARE_RULES.worktopBoltSize,
    wallGap: 8,
    edgeFront: 'Передний край — радиус R3',
    edgeVisible: 'Видимые боковые края — кромка ПВХ 1 мм в цвет',
    notes: [
      'Размеры даны без учёта кривизны стен. Перед раскроем снять чистовые размеры по месту.',
      'Пристеночный зазор 8 мм по всему периметру, заполняется герметиком.',
      'Вырезы под технику делать с учётом установочных зазоров из инструкции техники.',
      'Видимые торцы обработать кромкой в цвет столешницы.',
    ],
  }
}

/** Лист «Схема столешниц»: детали в плане с вырезами и размерами. */
export function renderWorktopSheet(plan: WorktopPlan, layout: KitchenLayout, title: string): string {
  const margin = { left: 80, right: 40, top: 56, bottom: 40 }
  const drawWidth = 900
  const longest = Math.max(...plan.parts.map((part) => part.length))
  const scale = drawWidth / longest
  const parts: string[] = []

  parts.push(text(margin.left, 26, title, { size: 15, anchor: 'start', weight: 600 }))
  parts.push(
    text(margin.left, 42, 'Схема столешниц · детали в плане · размеры в мм', {
      size: 11,
      anchor: 'start',
      fill: THIN,
    }),
  )

  let cursorY = margin.top + 20
  for (const part of plan.parts) {
    const partWidth = part.length * scale
    const partDepth = part.depth * scale
    const x0 = margin.left
    const y0 = cursorY

    parts.push(text(x0, y0 - 10, part.label, { size: 12, anchor: 'start', weight: 600 }))
    parts.push(
      text(x0 + partWidth, y0 - 10, `${part.length} × ${part.depth} × ${part.thickness} мм`, {
        size: 11,
        anchor: 'end',
        fill: THIN,
      }),
    )

    parts.push(rect(x0, y0, partWidth, partDepth, { fill: '#f4f2ee', strokeWidth: 1.6 }))

    // Пристеночный зазор показываем штрихом вдоль дальнего края.
    parts.push(
      line(x0, y0 + plan.wallGap * scale, x0 + partWidth, y0 + plan.wallGap * scale, {
        stroke: THIN,
        dash: '4 3',
      }),
    )

    for (const cutout of part.cutouts) {
      const cx = x0 + (cutout.centre - cutout.width / 2) * scale
      const cy = y0 + ((part.depth - cutout.depth) / 2) * scale
      parts.push(
        rect(cx, cy, cutout.width * scale, cutout.depth * scale, {
          fill: '#ffffff',
          stroke: INK,
          dash: '6 3',
        }),
      )
      parts.push(
        text(cx + (cutout.width * scale) / 2, cy + (cutout.depth * scale) / 2 - 3, cutout.label, {
          size: 9,
          fill: THIN,
        }),
      )
      parts.push(
        text(
          cx + (cutout.width * scale) / 2,
          cy + (cutout.depth * scale) / 2 + 10,
          `${cutout.width} × ${cutout.depth}`,
          { size: 10, weight: 600 },
        ),
      )
      // Привязка выреза к левому краю детали.
      parts.push(
        dimensionH(x0, cx, y0 + partDepth + 22, String(Math.round(cutout.centre - cutout.width / 2))),
      )
    }

    parts.push(dimensionH(x0, x0 + partWidth, y0 + partDepth + 48, String(part.length), 11))
    parts.push(dimensionV(y0, y0 + partDepth, x0 - 26, String(part.depth)))

    cursorY += partDepth + 96
  }

  // Разрез по толщине.
  const sectionY = cursorY + 6
  parts.push(text(margin.left, sectionY - 10, 'Разрез по толщине', { size: 12, anchor: 'start', weight: 600 }))
  const sectionHeight = 26
  parts.push(rect(margin.left, sectionY, 320, sectionHeight, { fill: '#e6e2da', strokeWidth: 1.4 }))
  parts.push(
    `<path d="M${margin.left} ${sectionY + 6} q6 -6 12 -6" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
  )
  parts.push(
    text(margin.left + 340, sectionY + 12, `${layout.counter.thickness} мм · ${plan.edgeFront}`, {
      size: 11,
      anchor: 'start',
      fill: THIN,
    }),
  )

  const height = sectionY + sectionHeight + margin.bottom
  return svgDocument(drawWidth + margin.left + margin.right, height, parts.join(''), `${title} — столешницы`)
}
