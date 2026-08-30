import type { KitchenLayout, KitchenModule, ModuleKind } from './types.ts'

/**
 * Разбивка фронта на модули стандартной ширины.
 *
 * Мебельщик работает не «стеной длиной 3460», а набором корпусов. Берём
 * ближайшее целое число модулей, выравниваем ширину по 10 мм, остаток
 * отдаём последнему модулю — так и делают при раскрое.
 */
export function splitRun(widthMm: number, preferred = 600, min = 300): number[] {
  if (widthMm < min) return widthMm > 50 ? [Math.round(widthMm)] : []
  const count = Math.max(1, Math.round(widthMm / preferred))
  const base = Math.floor(widthMm / count / 10) * 10
  const widths = new Array<number>(count).fill(base)
  widths[count - 1] = Math.round(widthMm - base * (count - 1))
  return widths
}

const mm = (metres: number) => Math.round(metres * 1000)

export interface LayoutInput {
  room: { width: number; height: number; depth: number }
  counter: { height: number; depth: number }
  run: { start: number; end: number }
  backsplashTop: number
  upperTop: number
  upperRuns: Array<{ start: number; end: number; kind: 'upper' | 'shelf' }>
  tallUnit: { start: number; end: number; depth: number; top: number } | null
  island: { x0: number; x1: number; z0: number; z1: number; top: number } | null
  window: { x0: number; x1: number; y0: number; y1: number } | null
  appliances: boolean
  hood: boolean
  hobCentre: number
  sinkCentre: number
  facadeLabel: string
}

/** Список модулей кухни в миллиметрах. */
export function buildLayout(input: LayoutInput): KitchenLayout {
  const modules: KitchenModule[] = []
  const counters: Record<string, number> = {}

  const push = (
    kind: ModuleKind,
    prefix: string,
    label: string,
    x: number,
    width: number,
    y: number,
    height: number,
    depth: number,
    doors: number,
  ) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    modules.push({
      id: `${prefix}${counters[prefix]}`,
      kind,
      label,
      x: Math.round(x),
      width: Math.round(width),
      y: Math.round(y),
      height: Math.round(height),
      depth: Math.round(depth),
      doors,
      facade: kind === 'shelf' || kind === 'appliance' ? undefined : input.facadeLabel,
    })
  }

  const counterHeight = mm(input.counter.height)
  const counterDepth = mm(input.counter.depth)
  const counterThickness = 38
  const plinth = 95

  // Нижний ряд.
  const baseStart = mm(input.run.start)
  const baseWidth = mm(input.run.end) - baseStart
  let cursor = baseStart
  for (const width of splitRun(baseWidth)) {
    push(
      'base',
      'Н',
      'Нижний модуль',
      cursor,
      width,
      plinth,
      counterHeight - counterThickness - plinth,
      counterDepth,
      width > 700 ? 2 : 1,
    )
    cursor += width
  }

  // Верхние ряды и открытые полки.
  for (const run of input.upperRuns) {
    const start = mm(run.start)
    const width = mm(run.end) - start
    if (width < 200) continue
    if (run.kind === 'shelf') {
      push('shelf', 'П', 'Открытая полка', start, width, mm(input.backsplashTop) + 240, 45, 280, 0)
      push('shelf', 'П', 'Открытая полка', start, width, mm(input.backsplashTop) + 580, 45, 280, 0)
      continue
    }
    let x = start
    for (const moduleWidth of splitRun(width, 500)) {
      push(
        'upper',
        'В',
        'Верхний модуль',
        x,
        moduleWidth,
        mm(input.backsplashTop),
        mm(input.upperTop) - mm(input.backsplashTop),
        340,
        moduleWidth > 600 ? 2 : 1,
      )
      x += moduleWidth
    }
  }

  // Пенал.
  if (input.tallUnit) {
    const start = mm(input.tallUnit.start)
    const width = mm(input.tallUnit.end) - start
    push('tall', 'Ш', 'Пенал', start, width, 0, mm(input.tallUnit.top), mm(input.tallUnit.depth), 2)
    if (input.appliances) {
      push(
        'appliance',
        'Т',
        'Духовой шкаф',
        start + 45,
        width - 90,
        1020,
        600,
        mm(input.tallUnit.depth) - 40,
        1,
      )
    }
  }

  // Остров.
  if (input.island) {
    const start = mm(input.island.x0)
    const width = mm(input.island.x1) - start
    const depth = mm(input.island.z1) - mm(input.island.z0)
    let x = start
    for (const moduleWidth of splitRun(width, 600)) {
      push('island', 'О', 'Модуль острова', x, moduleWidth, plinth, mm(input.island.top) - plinth, depth, 1)
      x += moduleWidth
    }
  }

  if (input.appliances) {
    const hob = mm(input.hobCentre)
    push('appliance', 'Т', 'Варочная панель', hob - 300, 600, counterHeight, 10, 520, 0)
  }
  // Мойка нужна и в спецификации, и в схеме столешницы.
  const sink = mm(input.sinkCentre)
  push('appliance', 'Т', 'Мойка', sink - 250, 500, counterHeight, 10, 500, 0)
  if (input.hood) {
    const hob = mm(input.hobCentre)
    push('appliance', 'Т', 'Вытяжка', hob - 450, 900, mm(input.upperTop) - 160, 140, 500, 0)
  }

  return {
    room: {
      width: mm(input.room.width),
      height: mm(input.room.height),
      depth: mm(input.room.depth),
    },
    counter: { height: counterHeight, depth: counterDepth, thickness: counterThickness },
    run: { start: baseStart, end: mm(input.run.end) },
    backsplash: { top: mm(input.backsplashTop) },
    window: input.window
      ? {
          x: mm(input.window.x0),
          width: mm(input.window.x1) - mm(input.window.x0),
          y: mm(input.window.y0),
          height: mm(input.window.y1) - mm(input.window.y0),
        }
      : null,
    modules,
  }
}
