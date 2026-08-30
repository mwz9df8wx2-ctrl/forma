import type { KitchenLayout, KitchenModule } from './types.ts'

/**
 * Расчёт фурнитуры и крепежа.
 *
 * Все значения считаются детерминированным кодом по явным правилам —
 * никакая языковая модель к этим числам не допускается. Нормы предварительные
 * и вынесены в HARDWARE_RULES, чтобы производство могло их поправить под себя.
 */

export const HARDWARE_RULES = {
  /** Толщина деталей корпуса, мм. */
  carcassThickness: 16,
  facadeThickness: 19,
  backPanelThickness: 4,
  /** Зазор между фасадами, мм. */
  facadeGap: 2,
  /** Конфирматов на базовый корпус: дно и крыша к двум боковинам. */
  confirmatsPerCarcass: 8,
  /** Конфирматов на каждую стационарную полку. */
  confirmatsPerShelf: 4,
  /** Угловой корпус: дополнительные стойки и связи. */
  confirmatsCornerExtra: 10,
  /** Пенал выше 1800: дополнительная связь по высоте. */
  confirmatsTallExtra: 6,
  confirmatSize: '7 × 50',
  /** Петли по высоте фасада. */
  hingesByHeight: [
    { maxHeight: 900, count: 2 },
    { maxHeight: 1600, count: 3 },
    { maxHeight: Number.POSITIVE_INFINITY, count: 4 },
  ],
  /** Ножки регулируемые: две на модуль плюс две концевые на ряд. */
  legsPerBaseModule: 2,
  legsPerRow: 2,
  legHeight: 100,
  /** Клипсы крепления цоколя. */
  clipsPerBaseModule: 2,
  /** Навесы верхних шкафов: один комплект (пара) на модуль. */
  bracketSetsPerUpper: 1,
  /** Стяжек на один стык столешницы. */
  worktopBoltsPerJoint: 3,
  worktopBoltSize: 'M6 × 65',
  screws16PerModule: 10,
  screws30PerModule: 5,
} as const

export interface ModuleHardware {
  confirmats: number
  hinges: number
  /** Угол открывания: у углового фасада нужен 165°. */
  hingeAngle: 110 | 165
  slides: number
  slideLength: number | null
  handles: number
  legs: number
  bracketSets: number
  clips: number
  screws16: number
  screws30: number
}

function hingesForFacade(height: number): number {
  for (const rule of HARDWARE_RULES.hingesByHeight) {
    if (height <= rule.maxHeight) return rule.count
  }
  return 4
}

/** Длина направляющей по глубине корпуса, мм. */
export function slideLengthForDepth(depth: number): number {
  if (depth >= 560) return 500
  if (depth >= 500) return 450
  return 400
}

/** Признак ящика: у нижних модулей высотой меньше 300 фасад ящичный. */
function isDrawerModule(module: KitchenModule): boolean {
  return module.kind === 'base' && module.label.toLowerCase().includes('ящик')
}

export function moduleHardware(
  module: KitchenModule,
  options: { handles: boolean; corner?: boolean },
): ModuleHardware {
  const rules = HARDWARE_RULES
  const corner = options.corner === true || module.label.toLowerCase().includes('углов')

  if (module.kind === 'appliance' || module.kind === 'shelf') {
    return {
      confirmats: module.kind === 'shelf' ? 4 : 0,
      hinges: 0,
      hingeAngle: 110,
      slides: 0,
      slideLength: null,
      handles: 0,
      legs: 0,
      bracketSets: 0,
      clips: 0,
      screws16: module.kind === 'shelf' ? 4 : 4,
      screws30: 0,
    }
  }

  const shelves = module.kind === 'tall' ? 4 : module.kind === 'upper' ? 1 : 1
  let confirmats = rules.confirmatsPerCarcass + shelves * rules.confirmatsPerShelf
  if (corner) confirmats += rules.confirmatsCornerExtra
  if (module.kind === 'tall' && module.height > 1800) confirmats += rules.confirmatsTallExtra

  const drawer = isDrawerModule(module)
  const facadeHeight = drawer ? Math.round(module.height / Math.max(1, module.doors)) : module.height
  const hinges = drawer ? 0 : module.doors * hingesForFacade(facadeHeight)
  const slides = drawer ? module.doors : 0

  return {
    confirmats,
    hinges,
    hingeAngle: corner ? 165 : 110,
    slides,
    slideLength: slides > 0 ? slideLengthForDepth(module.depth) : null,
    handles: options.handles ? module.doors : 0,
    legs: module.kind === 'base' || module.kind === 'island' ? rules.legsPerBaseModule : 0,
    bracketSets: module.kind === 'upper' ? rules.bracketSetsPerUpper : 0,
    clips: module.kind === 'base' || module.kind === 'island' ? rules.clipsPerBaseModule : 0,
    screws16: rules.screws16PerModule,
    screws30: rules.screws30PerModule,
  }
}

export interface HardwareLine {
  name: string
  count: number
  unit: string
  note?: string
}

/** Ведомость крепежа и фурнитуры на весь проект. */
export function hardwareTotals(
  layout: KitchenLayout,
  options: { handles: boolean; worktopJoints: number },
): HardwareLine[] {
  const rules = HARDWARE_RULES
  let confirmats = 0
  let hinges110 = 0
  let hinges165 = 0
  let slides = 0
  let handles = 0
  let legs = 0
  let bracketSets = 0
  let clips = 0
  let screws16 = 0
  let screws30 = 0
  const slideLengths = new Set<number>()

  let baseRows = 0
  for (const module of layout.modules) {
    const hardware = moduleHardware(module, { handles: options.handles })
    confirmats += hardware.confirmats
    if (hardware.hingeAngle === 165) hinges165 += hardware.hinges
    else hinges110 += hardware.hinges
    slides += hardware.slides
    handles += hardware.handles
    legs += hardware.legs
    bracketSets += hardware.bracketSets
    clips += hardware.clips
    screws16 += hardware.screws16
    screws30 += hardware.screws30
    if (hardware.slideLength) slideLengths.add(hardware.slideLength)
    if (module.kind === 'base') baseRows = 1
  }
  legs += baseRows * rules.legsPerRow

  const lines: HardwareLine[] = [
    { name: `Конфирмат ${rules.confirmatSize}`, count: confirmats, unit: 'шт' },
    { name: 'Петля 110°', count: hinges110, unit: 'шт' },
  ]
  if (hinges165 > 0) {
    lines.push({ name: 'Петля 165° (угловой фасад)', count: hinges165, unit: 'шт' })
  }
  if (slides > 0) {
    lines.push({
      name: `Направляющая шариковая ${[...slideLengths].join('/')} мм`,
      count: slides,
      unit: 'пар',
    })
  }
  if (handles > 0) lines.push({ name: 'Ручка', count: handles, unit: 'шт' })
  lines.push(
    { name: `Ножка регулируемая ${rules.legHeight} мм`, count: legs, unit: 'шт' },
    { name: 'Клипса крепления цоколя', count: clips, unit: 'шт' },
    { name: 'Навес верхнего шкафа', count: bracketSets, unit: 'компл.' },
    {
      name: `Стяжка столешницы ${rules.worktopBoltSize}`,
      count: options.worktopJoints * rules.worktopBoltsPerJoint,
      unit: 'шт',
      note: options.worktopJoints > 0 ? `${rules.worktopBoltsPerJoint} на каждый стык` : undefined,
    },
    { name: 'Саморез 4 × 16', count: screws16, unit: 'шт', note: 'ориентировочно' },
    { name: 'Саморез 4 × 30', count: screws30, unit: 'шт', note: 'ориентировочно' },
    { name: 'Дюбель/анкер для навески', count: bracketSets * 2, unit: 'шт', note: 'по типу стены' },
  )

  return lines.filter((line) => line.count > 0)
}

/** Размер фасада по проёму: детерминированное правило зазоров. */
export function facadeSize(
  module: KitchenModule,
): { width: number; height: number; count: number } {
  const gap = HARDWARE_RULES.facadeGap
  const count = Math.max(1, module.doors)
  // Между соседними фасадами один зазор, по краям — по половине.
  const width = Math.round((module.width - gap * count) / count)
  const height = Math.round(module.height - gap)
  return { width, height, count }
}
