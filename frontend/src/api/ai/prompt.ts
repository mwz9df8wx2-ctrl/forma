import type { Catalog, ProjectParams } from '@/types'

/**
 * Сборка описания сцены для модели.
 *
 * По умолчанию prompt строит бэкенд — фронтенд отправляет только идентификаторы.
 * Этот модуль работает лишь в режиме прямого подключения к провайдеру, когда
 * бэкенда нет вовсе. Пользователю текст запроса не показывается никогда.
 */

const MATERIALS: Record<string, string> = {
  mdf: 'matte MDF cabinet fronts',
  enamel: 'hand-painted lacquered enamel cabinet fronts',
  'solid-wood': 'solid hardwood cabinet fronts with visible grain',
  veneer: 'natural wood veneer cabinet fronts',
  chipboard: 'laminated board cabinet fronts',
  acrylic: 'high-gloss acrylic cabinet fronts',
}

const TEXTURES: Record<string, string> = {
  matte: 'deep matte finish with no reflections',
  glossy: 'mirror-like high gloss finish',
  satin: 'soft satin sheen',
  wood: 'pronounced natural wood grain',
  stone: 'mineral stone-like surface',
  textured: 'fine tactile relief texture',
}

const COUNTERTOPS: Record<string, string> = {
  quartz: 'engineered quartz countertop',
  'natural-stone': 'natural stone countertop with veining',
  hpl: 'thin compact laminate countertop',
  'wood-top': 'solid wood countertop',
  porcelain: 'large-format porcelain countertop',
}

const STYLES: Record<string, string> = {
  'modern-minimal': 'modern minimalist kitchen, clean lines, handleless fronts',
  'modern-classic': 'contemporary classic kitchen with restrained shaker panel doors',
  scandinavian: 'scandinavian kitchen, light and airy, open shelving, natural wood',
  japandi: 'japandi kitchen, calm japanese minimalism blended with scandinavian warmth',
  loft: 'industrial loft kitchen, exposed structure, dark metal, concrete wall',
  neoclassic: 'neoclassical kitchen, symmetric composition, framed panel doors',
  'premium-modern': 'premium contemporary kitchen, large uninterrupted planes, luxury materials',
}

const LIGHTING: Record<string, string> = {
  natural: 'soft natural daylight from the windows',
  'bright-white': 'bright clean lighting with a cool white tone, 5000K',
  neutral: 'balanced neutral white lighting, 4000K',
  warm: 'cosy warm golden lighting, 2700K',
  'warm-diffused': 'soft even diffused warm lighting, 3000K, no harsh shadows',
  contrast: 'dramatic directional lighting with pronounced light and shadow',
}

const OPTIONS: Record<string, string> = {
  'keep-layout': 'keep the original room layout and furniture placement',
  'keep-windows': 'keep window positions exactly as in the photo',
  'keep-doors': 'keep door openings exactly as in the photo',
  'keep-perspective': 'keep the exact camera angle and perspective of the photo',
  'built-in-appliances': 'include built-in oven, hob and extractor hood integrated into the fronts',
  'accent-lighting': 'add LED strip lighting under the wall cabinets',
  island: 'add a kitchen island in the centre of the room',
}

function find<T extends { id: string; name: string }>(items: T[], id: string | null): T | undefined {
  return items.find((item) => item.id === id)
}

export function buildAiPrompt(catalog: Catalog, params: ProjectParams): string {
  const color = find(catalog.colors, params.colorId)
  const countertopColor = find(catalog.countertops.colors, params.countertopColorId)
  const palette = find(catalog.palettes, params.paletteId)
  const style = find(catalog.styles, params.styleId)

  const parts: string[] = [
    'Photorealistic interior photograph of this exact kitchen after a full renovation.',
    'Preserve the room geometry, proportions and camera perspective of the source photo.',
    `Style: ${STYLES[params.styleId ?? ''] ?? 'modern kitchen'}.`,
    `Cabinet fronts: ${MATERIALS[params.materialId ?? ''] ?? 'painted cabinet fronts'}, ${
      TEXTURES[params.textureId ?? ''] ?? 'matte finish'
    }, colour ${color?.name ?? 'neutral'} (${color?.hex ?? '#EEE'}).`,
    `Countertop and backsplash: ${COUNTERTOPS[params.countertopMaterialId ?? ''] ?? 'stone countertop'}, colour ${
      countertopColor?.name ?? 'light'
    } (${countertopColor?.hex ?? '#EEE'}).`,
  ]

  if (palette) {
    parts.push(
      `Overall colour palette: ${palette.swatches.map((swatch) => swatch.hex).join(', ')}.`,
    )
  }

  parts.push(`Lighting: ${LIGHTING[params.lightingId ?? ''] ?? 'natural daylight'}.`)

  const enabled = Object.entries(params.options)
    .filter(([, value]) => value)
    .map(([id]) => OPTIONS[id])
    .filter(Boolean)
  if (enabled.length > 0) parts.push(`Requirements: ${enabled.join('; ')}.`)

  const { roomWidth, roomHeight, counterHeight, counterDepth } = params.dimensions
  parts.push(
    `Room dimensions: ${roomWidth} mm wide, ${roomHeight} mm high; countertop ${counterHeight} mm high and ${counterDepth} mm deep.`,
  )
  parts.push(
    'Ultra realistic architectural interior photography, full-frame 35mm lens, natural depth of field, physically correct materials and reflections, high detail, no text, no watermark, no people.',
  )

  if (style) parts.push(`Mood: ${style.description}`)

  return parts.join(' ')
}
