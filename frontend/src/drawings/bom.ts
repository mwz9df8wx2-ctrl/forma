import type { EstimateRequestLine } from '@shared/index'
import type { HardwareLine } from './hardware'
import type { FurnitureLayout, FurnitureModule } from './types'
import type { WorktopPlan } from './worktop'

/**
 * Ведомость материалов.
 *
 * Считается из той же геометрии, что и чертежи: количество на чертеже и
 * количество в смете обязаны совпадать, иначе цех закупит не то.
 *
 * Цены здесь не участвуют. Их подставляет сервер из каталога компании —
 * цена, пришедшая из браузера, не цена.
 */

/** Количества передаются в тысячных долях единицы: 2,45 м² — это 2450. */
function milli(value: number): number {
  return Math.max(0, Math.round(value * 1000))
}

/** Площадь деталей корпуса одного модуля, м². */
function carcassArea(module: FurnitureModule, backPanel: boolean): number {
  const { width, height, depth } = module
  // Две боковины, дно и крыша. Задняя стенка считается отдельным материалом,
  // но по площади идёт в тот же лист.
  const sides = 2 * height * depth
  const horizontals = 2 * width * depth
  const back = backPanel ? width * height : 0
  return (sides + horizontals + back) / 1_000_000
}

export interface BomInput {
  layout: FurnitureLayout
  worktop: WorktopPlan
  hardware: HardwareLine[]
  /** Записи каталога, выбранные в проекте. Без них строка идёт без цены. */
  facadeItemId: string | null
  countertopItemId: string | null
  carcassItemId: string | null
  /** Фурнитура каталога по типу: петли, направляющие, конфирматы. */
  hardwareItemIds: Partial<Record<HardwareLine['kind'], string>>
  facadeName: string
  countertopName: string
  carcassName: string
}

export function buildBom(input: BomInput): EstimateRequestLine[] {
  const lines: EstimateRequestLine[] = []

  const facadeArea = input.layout.modules
    .filter((module) => module.kind !== 'appliance' && module.doors > 0)
    .reduce((sum, module) => sum + (module.width * module.height) / 1_000_000, 0)

  if (facadeArea > 0) {
    lines.push({
      section: 'facade',
      catalogItemId: input.facadeItemId,
      name: input.facadeName,
      unit: 'square_metre',
      quantityMilli: milli(facadeArea),
      note: 'по габаритам фасадов, без запаса на раскрой',
    })
  }

  const worktopMetres = input.worktop.parts.reduce((sum, part) => sum + part.length / 1000, 0)
  if (worktopMetres > 0) {
    lines.push({
      section: 'countertop',
      catalogItemId: input.countertopItemId,
      name: input.countertopName,
      unit: 'linear_metre',
      quantityMilli: milli(worktopMetres),
      note:
        input.worktop.joints > 0
          ? `${input.worktop.joints} стык под 90°, стяжки в разделе фурнитуры`
          : 'без стыков',
    })
  }

  const carcass = input.layout.modules
    .filter((module) => module.kind !== 'appliance')
    .reduce((sum, module) => sum + carcassArea(module, true), 0)

  if (carcass > 0) {
    lines.push({
      section: 'carcass',
      catalogItemId: input.carcassItemId,
      name: input.carcassName,
      unit: 'square_metre',
      quantityMilli: milli(carcass),
      note: 'боковины, дно, крыша и задняя стенка',
    })
  }

  for (const line of input.hardware) {
    lines.push({
      section: 'hardware',
      catalogItemId: input.hardwareItemIds[line.kind] ?? null,
      name: line.name,
      unit: 'piece',
      quantityMilli: milli(line.count),
      note: line.note ?? '',
    })
  }

  return lines
}
