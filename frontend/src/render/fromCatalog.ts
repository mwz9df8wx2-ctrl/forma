import { buildScene, type SceneInput } from './scene.ts'
import { isObjectCategory } from '../drawings/object.ts'
import type { PatternKind } from './types.ts'
import type { Catalog, GrainKind, ProjectParams } from '../types/index.ts'

const PATTERNS: Record<GrainKind, PatternKind> = {
  flat: 'paint',
  wood: 'wood',
  veneer: 'veneer',
  stone: 'stone',
  marble: 'marble',
  linear: 'linear',
  gloss: 'gloss',
  speck: 'speck',
}

/** Шероховатость столешницы по материалу. */
const COUNTERTOP_ROUGHNESS: Record<string, number> = {
  quartz: 0.2,
  'natural-stone': 0.17,
  hpl: 0.42,
  'wood-top': 0.46,
  porcelain: 0.24,
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (Math.abs(hash) % 1000) / 7 + 1
}

/** Справочник + выбор пользователя → исходные данные сцены. */
export function sceneInputFromParams(
  catalog: Catalog,
  params: ProjectParams,
  variant: number,
  quality: 'preview' | 'high' = 'high',
): SceneInput {
  const material = catalog.materials.find((item) => item.id === params.materialId) ?? catalog.materials[0]
  const color = catalog.colors.find((item) => item.id === params.colorId) ?? catalog.colors[0]
  const texture = catalog.textures.find((item) => item.id === params.textureId) ?? catalog.textures[0]
  const palette = catalog.palettes.find((item) => item.id === params.paletteId) ?? catalog.palettes[0]
  const style = catalog.styles.find((item) => item.id === params.styleId) ?? catalog.styles[0]
  const lighting = catalog.lighting.find((item) => item.id === params.lightingId) ?? catalog.lighting[0]
  const countertopMaterial =
    catalog.countertops.materials.find((item) => item.id === params.countertopMaterialId) ??
    catalog.countertops.materials[0]
  const countertopColor =
    catalog.countertops.colors.find((item) => item.id === params.countertopColorId) ??
    catalog.countertops.colors[0]

  const swatches = palette.swatches
  const wall = swatches[0]?.hex ?? '#EFEDE8'
  const accent = swatches[swatches.length - 1]?.hex ?? '#C09A6B'
  const floor = swatches.length > 2 ? swatches[swatches.length - 1].hex : accent

  const facadeGrain: GrainKind =
    texture.grain !== 'flat' ? texture.grain : color.grain !== 'flat' ? color.grain : material.preview.grain
  const counterGrain: GrainKind =
    countertopColor.grain !== 'flat' ? countertopColor.grain : countertopMaterial.preview.grain

  const roomWidth = params.dimensions.roomWidth / 1000
  const roomHeight = params.dimensions.roomHeight / 1000

  return {
    // Корпусная мебель строится своей сценой; остальные категории рисуются
    // как кухня, пока для них не появилась собственная геометрия.
    category: isObjectCategory(params.category) ? params.category : ('kitchen' as const),
    // auto оставляет выбор ракурса варианту: три результата — три взгляда.
    viewAngle: params.viewAngle === 'auto' ? undefined : params.viewAngle,
    room: {
      width: roomWidth,
      height: roomHeight,
      depth: Math.max(2.4, Math.min(9, params.dimensions.roomDepth / 1000)),
    },
    counter: {
      height: params.dimensions.counterHeight / 1000,
      depth: params.dimensions.counterDepth / 1000,
    },
    // Боковой фронт участвует только в угловой планировке: у прямой кухни
    // длина боковой стены может быть заполнена, но мебели там нет.
    sideRun: params.layoutKind === 'corner' ? params.dimensions.sideRun / 1000 : 0,
    facade: {
      color: color.hex,
      pattern: PATTERNS[facadeGrain],
      roughness: Math.min(0.78, Math.max(0.05, 0.66 - texture.gloss * 0.6)),
      handles: style.traits.handles,
      frame: style.traits.framedDoors,
      label: `${material.name}, ${color.name.toLowerCase()}`,
    },
    countertop: {
      color: countertopColor.hex,
      pattern: PATTERNS[counterGrain],
      roughness: COUNTERTOP_ROUGHNESS[countertopMaterial.id] ?? 0.3,
    },
    wall,
    floor,
    accent,
    light: {
      warmth: lighting.warmth,
      brightness: lighting.brightness,
      contrast: lighting.contrast,
    },
    options: {
      island: params.options['island'] === true,
      appliances: params.options['built-in-appliances'] === true,
      hood: params.options['hood'] === true,
      ledLight: params.options['accent-lighting'] === true,
      windows: params.options['keep-windows'] !== false,
      openShelves: style.traits.openShelves,
    },
    variant,
    quality,
    seed: hashSeed(`${color.id}${texture.id}${palette.id}${style.id}`),
  }
}

export function buildSceneFromParams(catalog: Catalog, params: ProjectParams, variant: number) {
  return buildScene(sceneInputFromParams(catalog, params, variant))
}
