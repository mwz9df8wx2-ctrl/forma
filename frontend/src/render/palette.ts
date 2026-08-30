import type { PanelLayout, RenderMaterial, SceneInput } from './types.ts'

/**
 * Палитра сцены: материалы и цветовые помощники.
 *
 * Кухня и шкаф красятся и освещаются одинаково — различается только
 * геометрия. Два набора материалов однажды дали бы кухню и шкаф разного
 * оттенка из одного и того же артикула каталога.
 */

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

/** Цвет каталога → линейное альбедо в физически осмысленном диапазоне. */
export function albedo(hex: string, min = 0.035, max = 0.87): [number, number, number] {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  const r = srgbToLinear(Number.parseInt(full.slice(0, 2), 16) / 255)
  const g = srgbToLinear(Number.parseInt(full.slice(2, 4), 16) / 255)
  const b = srgbToLinear(Number.parseInt(full.slice(4, 6), 16) / 255)
  return [clamp(r, min, max), clamp(g, min, max), clamp(b, min, max)]
}

/** Цвет источника по цветовой температуре, нормированный по яркости. */
export function lightColor(warmth: number): [number, number, number] {
  const cool: [number, number, number] = [0.86, 0.92, 1.0]
  const warm: [number, number, number] = [1.0, 0.78, 0.55]
  return [
    cool[0] + (warm[0] - cool[0]) * warmth,
    cool[1] + (warm[1] - cool[1]) * warmth,
    cool[2] + (warm[2] - cool[2]) * warmth,
  ]
}


/** Индексы материалов в общем списке сцены. */
export interface ScenePalette {
  list: RenderMaterial[]
  wall: number
  ceiling: number
  floor: number
  facadeBase: number
  facadeUpper: number
  facadeTall: number
  counter: number
  backsplash: number
  toe: number
  metal: number
  darkGlass: number
  shelf: number
  carcass: number
  window: number
  lamp: number
  sky: [number, number, number]
  lampTone: [number, number, number]
}

export function createPalette(input: SceneInput): ScenePalette {
  const warm = input.light.warmth
  const brightness = input.light.brightness
  const list: RenderMaterial[] = []
  const addMaterial = (material: RenderMaterial) => list.push(material) - 1

  const facadePanel = (doorWidth: number, upper = false): PanelLayout => ({
    doorWidth,
    gap: 0.005,
    handle: input.facade.handles,
    frame: input.facade.frame,
    upper,
  })

  const wallMaterial = addMaterial({
    albedo: albedo(input.surfaces?.wall ?? input.wall, 0.18, 0.85),
    roughness: 0.92,
    metallic: 0,
    pattern: 'wall',
    scale: 1,
  })
  const ceilingMaterial = addMaterial({
    albedo: input.surfaces ? albedo(input.surfaces.ceiling, 0.3, 0.9) : [0.82, 0.81, 0.79],
    roughness: 0.95,
    metallic: 0,
    pattern: 'wall',
    scale: 1,
  })
  const floorMaterial = addMaterial({
    albedo: albedo(input.surfaces?.floor ?? input.floor, 0.05, 0.65),
    roughness: 0.34,
    metallic: 0,
    pattern: 'floor',
    scale: 1,
  })
  const facadeBase = addMaterial({
    albedo: albedo(input.facade.color),
    roughness: input.facade.roughness,
    metallic: 0,
    pattern: input.facade.pattern,
    scale: 1,
    panel: facadePanel(0.6),
  })
  const facadeUpper = addMaterial({
    albedo: albedo(input.facade.color),
    roughness: input.facade.roughness,
    metallic: 0,
    pattern: input.facade.pattern,
    scale: 1,
    panel: facadePanel(0.5, true),
  })
  const facadeTall = addMaterial({
    albedo: albedo(input.facade.color),
    roughness: input.facade.roughness,
    metallic: 0,
    pattern: input.facade.pattern,
    scale: 1,
    panel: facadePanel(0.65),
  })
  const counterMaterial = addMaterial({
    albedo: albedo(input.countertop.color, 0.05, 0.85),
    roughness: input.countertop.roughness,
    metallic: 0,
    pattern: input.countertop.pattern,
    scale: 1,
  })
  const backsplashMaterial = addMaterial({
    albedo: albedo(input.countertop.color, 0.08, 0.86),
    roughness: Math.min(0.4, input.countertop.roughness + 0.06),
    metallic: 0,
    pattern: input.countertop.pattern === 'wood' ? 'tile' : input.countertop.pattern,
    scale: 1,
  })
  const toeMaterial = addMaterial({
    albedo: [0.035, 0.035, 0.037],
    roughness: 0.6,
    metallic: 0,
    pattern: 'paint',
    scale: 1,
  })
  const metalMaterial = addMaterial({
    albedo: [0.6, 0.61, 0.62],
    roughness: 0.24,
    metallic: 0.9,
    pattern: 'metal',
    scale: 1,
  })
  const darkGlassMaterial = addMaterial({
    albedo: [0.04, 0.042, 0.045],
    roughness: 0.3,
    metallic: 0.3,
    pattern: 'dark-glass',
    scale: 1,
  })
  // Корпус внутри шкафа обычно светлее фасада: так делают, чтобы содержимое
  // было видно. Берём цвет фасада и уводим его к светлому нейтральному.
  const facadeAlbedo = albedo(input.facade.color)
  const carcassMaterial = addMaterial({
    albedo: [
      clamp(facadeAlbedo[0] * 0.4 + 0.44, 0.05, 0.9),
      clamp(facadeAlbedo[1] * 0.4 + 0.43, 0.05, 0.9),
      clamp(facadeAlbedo[2] * 0.4 + 0.41, 0.05, 0.9),
    ],
    roughness: 0.62,
    metallic: 0,
    pattern: 'paint',
    scale: 1,
  })

  const shelfMaterial = addMaterial({
    albedo: albedo(input.accent, 0.05, 0.7),
    roughness: 0.4,
    metallic: 0,
    pattern: 'wood',
    scale: 1,
  })

  const sky = lightColor(warm * 0.55)
  const windowGlow = 2.6 + brightness * 2.6
  const windowMaterial = addMaterial({
    albedo: [1, 1, 1],
    roughness: 1,
    metallic: 0,
    pattern: 'paint',
    scale: 1,
    emission: [sky[0] * windowGlow, sky[1] * windowGlow, sky[2] * windowGlow],
  })

  const lampTone = lightColor(Math.max(warm, 0.6))
  const lampGlow = 5 + brightness * 4
  const lampMaterial = addMaterial({
    albedo: [1, 1, 1],
    roughness: 1,
    metallic: 0,
    pattern: 'paint',
    scale: 1,
    emission: [lampTone[0] * lampGlow, lampTone[1] * lampGlow, lampTone[2] * lampGlow],
  })


  return {
    list,
    wall: wallMaterial,
    ceiling: ceilingMaterial,
    floor: floorMaterial,
    facadeBase,
    facadeUpper,
    facadeTall,
    counter: counterMaterial,
    backsplash: backsplashMaterial,
    toe: toeMaterial,
    metal: metalMaterial,
    darkGlass: darkGlassMaterial,
    shelf: shelfMaterial,
    carcass: carcassMaterial,
    window: windowMaterial,
    lamp: lampMaterial,
    sky,
    lampTone,
  }
}
