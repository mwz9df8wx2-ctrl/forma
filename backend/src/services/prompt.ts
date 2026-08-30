import { db } from '../db/connection.ts'
import type { ProjectSpec } from '../../../shared/src/index.ts'

/**
 * Сборка подсказки для провайдера — на сервере, а не в браузере.
 *
 * Причина простая: каждый вызов провайдера стоит денег. Если текст приходит
 * от клиента целиком, то любой, кто откроет консоль, оплатит из бюджета
 * компании что угодно. Клиент присылает только пожелания ограниченной длины,
 * а описание сцены строится из ProjectSpec — из того же источника,
 * из которого считаются чертежи.
 */

const CATEGORY_EN: Record<string, string> = {
  kitchen: 'kitchen',
  wardrobe: 'wardrobe',
  cabinet: 'cabinet unit',
  tv_zone: 'TV wall unit',
  hallway: 'hallway furniture',
  bathroom: 'bathroom furniture',
  shelving: 'shelving unit',
  custom: 'built-in furniture',
}

const APPLIANCE_EN: Record<string, string> = {
  hob: 'cooktop',
  oven: 'built-in oven',
  dishwasher: 'dishwasher',
  fridge: 'refrigerator',
  microwave: 'microwave',
  hood: 'extractor hood',
  sink: 'sink',
}

function catalogName(id: string | null): string | null {
  if (!id) return null
  const row = db().prepare('SELECT name FROM catalog_items WHERE id = ?').get(id) as
    | { name: string }
    | undefined
  return row?.name ?? null
}

/** Ограничение на свободный текст клиента: длинный ввод дорожает и уводит модель. */
export const MAX_NOTES_LENGTH = 400

export interface PromptInput {
  spec: ProjectSpec
  notes?: string
}

export function buildImagePrompt(input: PromptInput): string {
  const { spec } = input
  const d = spec.dimensions
  const parts: string[] = []

  parts.push(
    `Photorealistic interior photograph of a custom ${CATEGORY_EN[spec.category] ?? 'furniture set'}, ` +
      `${spec.layoutKind === 'corner' ? 'L-shaped corner layout' : 'single-wall straight layout'}.`,
  )
  parts.push(
    `Room ${(d.roomWidth / 1000).toFixed(2)} m wide, ${(d.roomDepth / 1000).toFixed(2)} m deep, ` +
      `ceiling ${(d.roomHeight / 1000).toFixed(2)} m. Worktop height ${d.counterHeight} mm, ` +
      `depth ${d.counterDepth} mm.`,
  )
  if (spec.layoutKind === 'corner' && d.sideRun > 0) {
    parts.push(`Side run along the adjacent wall ${(d.sideRun / 1000).toFixed(2)} m.`)
  }

  const facade = catalogName(spec.materials.materialId)
  const colour = catalogName(spec.materials.colorId)
  const worktop = catalogName(spec.materials.countertopMaterialId)
  if (facade || colour) {
    parts.push(`Facades: ${[facade, colour].filter(Boolean).join(', ')}.`)
  }
  if (worktop) parts.push(`Worktop: ${worktop}.`)

  const appliances = spec.appliances
    .map((item) => `${APPLIANCE_EN[item.slot] ?? item.slot} ${item.widthMm} mm`)
    .join(', ')
  if (appliances) parts.push(`Appliances in place: ${appliances}.`)

  // Вытяжка появляется только если её явно попросили: додуманная техника
  // на визуализации — самая частая претензия клиента.
  if (!spec.appliances.some((item) => item.slot === 'hood')) {
    parts.push('No extractor hood, no appliances that were not listed.')
  }

  parts.push(
    'Straight-on eye-level view, 35 mm lens, no fisheye. Daylight from the side plus warm under-cabinet ' +
      'lighting. Sharp focus, true-to-scale proportions, no text, no watermarks, no people.',
  )

  const notes = (input.notes ?? spec.notes ?? '').trim().slice(0, MAX_NOTES_LENGTH)
  if (notes) parts.push(`Client wishes: ${notes}`)

  return parts.join(' ')
}
