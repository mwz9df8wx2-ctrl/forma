import type { AreaLight, PanelLayout, PatternKind, RenderBox, RenderMaterial, SceneSpec } from './types.ts'
import { buildLayout } from '../drawings/layout.ts'
import type { KitchenLayout } from '../drawings/types.ts'

/** Исходные данные сцены — уже разрешённые значения, без справочников. */
export interface SceneInput {
  room: { width: number; height: number; depth: number }
  counter: { height: number; depth: number }
  facade: {
    color: string
    pattern: PatternKind
    roughness: number
    handles: 'hidden' | 'bar' | 'knob'
    frame: boolean
    /** Человеческое название материала и цвета — попадает в спецификацию. */
    label?: string
  }
  countertop: { color: string; pattern: PatternKind; roughness: number }
  wall: string
  floor: string
  accent: string
  light: { warmth: number; brightness: number; contrast: number }
  options: {
    island: boolean
    appliances: boolean
    /** Вытяжка рисуется только по явному запросу. */
    hood: boolean
    ledLight: boolean
    windows: boolean
    openShelves: boolean
  }
  variant: number
  seed: number
  /**
   * Вписывание в фотографию: стены, пол, потолок и окно не рисуются,
   * но продолжают освещать сцену и принимать тень.
   */
  compositing?: boolean
  /** Камера, рассчитанная по фотографии. */
  camera?: {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
  }
  /** Цвета реальных поверхностей — для корректного переотражённого света. */
  surfaces?: { wall: string; floor: string; ceiling: string }
  /**
   * Окно в координатах сцены. Задаётся, когда положение окна взято
   * с фотографии: свет должен приходить оттуда же, откуда на снимке.
   * null — окна в кадре нет.
   */
  windowRect?: { x0: number; y0: number; x1: number; y1: number } | null
  /**
   * preview — меньше выборок света: расчёт в браузере должен укладываться
   * в несколько секунд. high — качество для изображений, отрисованных заранее.
   */
  quality?: 'preview' | 'high'
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

/** Цвет каталога → линейное альбедо в физически осмысленном диапазоне. */
function albedo(hex: string, min = 0.035, max = 0.87): [number, number, number] {
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
function lightColor(warmth: number): [number, number, number] {
  const cool: [number, number, number] = [0.86, 0.92, 1.0]
  const warm: [number, number, number] = [1.0, 0.78, 0.55]
  return [
    cool[0] + (warm[0] - cool[0]) * warmth,
    cool[1] + (warm[1] - cool[1]) * warmth,
    cool[2] + (warm[2] - cool[2]) * warmth,
  ]
}

export function buildScene(input: SceneInput): SceneSpec {
  const W = clamp(input.room.width, 2.4, 6.4)
  const H = clamp(input.room.height, 2.35, 3.5)
  const D = clamp(input.room.depth, 3.1, 5.2)
  const Hc = clamp(input.counter.height, 0.72, 1.06)
  const Dc = clamp(input.counter.depth, 0.42, 0.86)

  const variant = ((input.variant % 3) + 3) % 3
  const preview = input.quality === 'preview'
  const windowSamples = preview ? 2 : 4
  const fillSamples = preview ? 1 : 3
  const warm = input.light.warmth
  const brightness = input.light.brightness

  const materials: RenderMaterial[] = []
  const boxes: RenderBox[] = []
  const lights: AreaLight[] = []

  const addMaterial = (material: RenderMaterial) => materials.push(material) - 1
  const compositing = input.compositing === true
  const addBox = (
    min: [number, number, number],
    max: [number, number, number],
    material: number,
    inverted = false,
  ) => {
    boxes.push({ min, max, material, inverted })
  }
  /** Часть комнаты: в режиме вписывания не рисуется, но освещает и затеняет. */
  const addRoomBox = (
    min: [number, number, number],
    max: [number, number, number],
    material: number,
    inverted = false,
    shadowCatcher = false,
  ) => {
    boxes.push({ min, max, material, inverted, hidden: compositing, shadowCatcher })
  }

  /**
   * Ряд мебели, разрезанный по оконному проёму. Без этого фартук и верхние
   * шкафы наезжают на настоящее окно с фотографии.
   */
  const addRunClippedByWindow = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    material: number,
    windowArea: { x0: number; y0: number; x1: number; y1: number } | null,
  ): Array<{ start: number; end: number }> => {
    const overlapsVertically = windowArea !== null && windowArea.y1 > y0 && windowArea.y0 < y1
    if (!overlapsVertically || windowArea === null) {
      addBox([x0, y0, z0], [x1, y1, z1], material)
      return [{ start: x0, end: x1 }]
    }

    const segments: Array<{ start: number; end: number }> = []
    const gap = 0.03
    const leftEnd = Math.min(x1, windowArea.x0 - gap)
    const rightStart = Math.max(x0, windowArea.x1 + gap)
    if (leftEnd - x0 > 0.12) {
      addBox([x0, y0, z0], [leftEnd, y1, z1], material)
      segments.push({ start: x0, end: leftEnd })
    }
    if (x1 - rightStart > 0.12) {
      addBox([rightStart, y0, z0], [x1, y1, z1], material)
      segments.push({ start: rightStart, end: x1 })
    }
    // Полоса под подоконником остаётся сплошной.
    if (windowArea.y0 - y0 > 0.03) {
      addBox([Math.max(x0, leftEnd), y0, z0], [Math.min(x1, rightStart), windowArea.y0 - 0.01, z1], material)
    }
    return segments
  }

  const facadePanel = (doorWidth: number, upper = false): PanelLayout => ({
    doorWidth,
    gap: 0.005,
    handle: input.facade.handles,
    frame: input.facade.frame,
    upper,
  })

  // --- Материалы ---
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

  // --- Оболочка помещения ---
  addRoomBox([-0.03, -0.2, -0.03], [W + 0.03, H + 0.2, D + 0.03], wallMaterial, true)
  addRoomBox([-0.03, -0.12, -0.03], [W + 0.03, 0, D + 0.03], floorMaterial, false, true)
  addRoomBox([-0.03, H, -0.03], [W + 0.03, H + 0.12, D + 0.03], ceilingMaterial)

  // --- Раскладка по вариантам ---
  const tallWidth = 0.66
  let tallUnit: [number, number] | null = null
  let runStart = 0.06
  let runEnd = W - 0.06

  if (variant === 0) {
    tallUnit = [W - 0.06 - tallWidth, W - 0.06]
    runEnd = tallUnit[0] - 0.02
  } else if (variant === 2) {
    tallUnit = [0.06, 0.06 + tallWidth]
    runStart = tallUnit[1] + 0.02
  }

  const runLength = runEnd - runStart
  const counterTop = Hc
  const backsplashTop = Hc + 0.58
  const upperTop = Math.min(H - 0.28, backsplashTop + 0.76)

  // Раскладка верхнего яруса и положение окна нужны раньше мебели:
  // фартук и шкафы разрезаются по проёму.
  let upperSplit = runStart + runLength * (variant === 1 ? 0.5 : 0.58)
  let windowRect: { x0: number; y0: number; x1: number; y1: number } | null = null
  const sideWindow = variant === 1 && input.options.windows && input.windowRect === undefined

  if (input.windowRect !== undefined) {
    windowRect = input.windowRect
  } else if (input.options.windows && !sideWindow) {
    const width = Math.min(1.5, runLength * 0.42)
    const centre = upperSplit + (runEnd - upperSplit) * 0.5
    windowRect = {
      x0: centre - width * 0.5,
      x1: centre + width * 0.5,
      y0: counterTop + 0.12,
      y1: Math.min(H - 0.35, counterTop + 0.12 + 1.05),
    }
  }

  // Верхние шкафы доводим вплотную к окну: иначе между ними и проёмом
  // остаётся просвет, в котором на снимке видна прежняя кухня.
  if (windowRect && windowRect.x0 - runStart > 0.5 && windowRect.y1 > backsplashTop) {
    upperSplit = Math.min(runEnd, windowRect.x0 - 0.03)
  }

  // Нижние шкафы, цоколь и столешница.
  addBox([runStart + 0.05, 0, D - Dc + 0.075], [runEnd - 0.05, 0.095, D], toeMaterial)
  addBox([runStart, 0.095, D - Dc], [runEnd, counterTop - 0.038, D], facadeBase)
  addBox(
    [runStart - 0.018, counterTop - 0.038, D - Dc - 0.022],
    [runEnd + 0.018, counterTop, D],
    counterMaterial,
  )
  addRunClippedByWindow(
    runStart,
    runEnd,
    counterTop,
    backsplashTop,
    D - 0.018,
    D,
    backsplashMaterial,
    windowRect,
  )

  // Верхний ярус.
  const upperRuns: Array<{ start: number; end: number; kind: 'upper' | 'shelf' }> = []
  for (const segment of addRunClippedByWindow(
    runStart,
    upperSplit,
    backsplashTop,
    upperTop,
    D - 0.34,
    D,
    facadeUpper,
    windowRect,
  )) {
    upperRuns.push({ ...segment, kind: 'upper' })
  }

  // Справа от окна вешаем шкафы, только если там осталось достаточно места.
  const rightOfWindow = windowRect ? runEnd - windowRect.x1 : runEnd - upperSplit
  const shelfBlocked = windowRect !== null && rightOfWindow < 0.5

  if (!shelfBlocked) {
    if (input.options.openShelves && variant !== 2) {
      for (const level of [backsplashTop + 0.24, backsplashTop + 0.58]) {
        addBox([upperSplit + 0.04, level, D - 0.28], [runEnd, level + 0.045, D], shelfMaterial)
      }
      upperRuns.push({ start: upperSplit + 0.04, end: runEnd, kind: 'shelf' })
    } else {
      for (const segment of addRunClippedByWindow(
        windowRect ? Math.max(upperSplit + 0.02, windowRect.x1 + 0.03) : upperSplit + 0.02,
        runEnd,
        backsplashTop,
        upperTop,
        D - 0.34,
        D,
        facadeUpper,
        windowRect,
      )) {
        upperRuns.push({ ...segment, kind: 'upper' })
      }
    }
  }

  if (windowRect && !compositing) {
    const { x0, x1, y0, y1 } = windowRect
    const frame = 0.055
    addRoomBox([x0, y0, D - 0.05], [x1, y1, D - 0.045], windowMaterial)
    addRoomBox([x0 - frame, y1, D - 0.055], [x1 + frame, y1 + frame, D - 0.02], ceilingMaterial)
    addRoomBox([x0 - frame, y0 - frame, D - 0.055], [x1 + frame, y0, D - 0.02], ceilingMaterial)
    addRoomBox([x0 - frame, y0, D - 0.055], [x0, y1, D - 0.02], ceilingMaterial)
    addRoomBox([x1, y0, D - 0.055], [x1 + frame, y1, D - 0.02], ceilingMaterial)
    const middle = (x0 + x1) * 0.5
    addRoomBox([middle - 0.016, y0, D - 0.053], [middle + 0.016, y1, D - 0.03], ceilingMaterial)
  }

  if (windowRect) {
    lights.push({
      origin: [windowRect.x0, windowRect.y0, D - 0.048],
      u: [windowRect.x1 - windowRect.x0, 0, 0],
      v: [0, windowRect.y1 - windowRect.y0, 0],
      normal: [0, 0, -1],
      color: sky,
      intensity: 15 + brightness * 16,
      samples: windowSamples,
    })
  }

  if (sideWindow) {
    const y0 = 0.95
    const y1 = Math.min(H - 0.32, 2.32)
    const z0 = D - Dc - 1.9
    const z1 = D - Dc - 0.35
    const frame = 0.055
    addRoomBox([0.02, y0, z0], [0.026, y1, z1], windowMaterial)
    addRoomBox([0.01, y1, z0 - frame], [0.045, y1 + frame, z1 + frame], ceilingMaterial)
    addRoomBox([0.01, y0 - frame, z0 - frame], [0.045, y0, z1 + frame], ceilingMaterial)
    addRoomBox([0.01, y0, z0 - frame], [0.045, y1, z0], ceilingMaterial)
    addRoomBox([0.01, y0, z1], [0.045, y1, z1 + frame], ceilingMaterial)
    lights.push({
      origin: [0.028, y0, z0],
      u: [0, y1 - y0, 0],
      v: [0, 0, z1 - z0],
      normal: [1, 0, 0],
      color: sky,
      intensity: 16 + brightness * 18,
      samples: windowSamples,
    })
  }

  // Пенал с духовым шкафом.
  if (tallUnit) {
    const tallDepth = Math.max(0.6, Dc)
    addBox([tallUnit[0], 0, D - tallDepth], [tallUnit[1], upperTop + 0.06, D], facadeTall)
    if (input.options.appliances) {
      addBox(
        [tallUnit[0] + 0.045, 1.02, D - tallDepth - 0.022],
        [tallUnit[1] - 0.045, 1.62, D - tallDepth],
        darkGlassMaterial,
      )
      addBox(
        [tallUnit[0] + 0.045, 1.6, D - tallDepth - 0.03],
        [tallUnit[1] - 0.045, 1.64, D - tallDepth],
        metalMaterial,
      )
    }
  }

  // Вытяжка и варочная панель.
  const hobCentre = runStart + runLength * (variant === 2 ? 0.68 : 0.3)
  if (input.options.appliances) {
    addBox(
      [hobCentre - 0.3, counterTop - 0.004, D - Dc + 0.06],
      [hobCentre + 0.3, counterTop + 0.006, D - 0.06],
      darkGlassMaterial,
    )
  }

  if (input.options.hood) {
    addBox(
      [hobCentre - 0.45, upperTop - 0.16, D - 0.5],
      [hobCentre + 0.45, upperTop - 0.02, D],
      metalMaterial,
    )
    addBox([hobCentre - 0.13, upperTop - 0.02, D - 0.28], [hobCentre + 0.13, H, D], metalMaterial)
  }

  // Мойка со смесителем.
  const sinkCentre = runStart + runLength * (variant === 2 ? 0.28 : 0.72)
  addBox(
    [sinkCentre - 0.26, counterTop - 0.012, D - Dc + 0.09],
    [sinkCentre + 0.26, counterTop - 0.004, D - 0.1],
    metalMaterial,
  )
  addBox(
    [sinkCentre - 0.02, counterTop, D - 0.14],
    [sinkCentre + 0.02, counterTop + 0.32, D - 0.1],
    metalMaterial,
  )
  addBox(
    [sinkCentre - 0.02, counterTop + 0.28, D - 0.3],
    [sinkCentre + 0.02, counterTop + 0.32, D - 0.1],
    metalMaterial,
  )

  // Подсветка рабочей зоны.
  if (input.options.ledLight) {
    addBox(
      [runStart + 0.04, backsplashTop - 0.02, D - 0.33],
      [upperSplit - 0.04, backsplashTop - 0.005, D - 0.3],
      lampMaterial,
    )
    lights.push({
      origin: [runStart + 0.04, backsplashTop - 0.02, D - 0.33],
      u: [upperSplit - runStart - 0.08, 0, 0],
      v: [0, 0, 0.03],
      normal: [0, -1, 0],
      color: lampTone,
      intensity: 34,
      samples: fillSamples,
    })
  }

  // Остров с подвесными светильниками.
  let islandBounds: { x0: number; x1: number; z0: number; z1: number; top: number } | null = null
  if (input.options.island) {
    const halfWidth = Math.min(0.72, (W - 1.6) * 0.5)
    const cx = W * 0.5
    const z1 = D - Dc - 0.88
    const z0 = z1 - 0.78
    islandBounds = { x0: cx - halfWidth, x1: cx + halfWidth, z0, z1, top: 0.9 }
    addBox([cx - halfWidth + 0.06, 0, z0 + 0.06], [cx + halfWidth - 0.06, 0.09, z1], toeMaterial)
    addBox([cx - halfWidth, 0.09, z0], [cx + halfWidth, 0.86, z1], facadeBase)
    addBox(
      [cx - halfWidth - 0.06, 0.86, z0 - 0.06],
      [cx + halfWidth + 0.06, 0.9, z1 + 0.06],
      counterMaterial,
    )

    for (const offset of [-halfWidth * 0.45, halfWidth * 0.45]) {
      const lx = cx + offset
      const lz = (z0 + z1) * 0.5
      addBox([lx - 0.008, 1.68, lz - 0.008], [lx + 0.008, H, lz + 0.008], metalMaterial)
      addBox([lx - 0.14, 1.5, lz - 0.14], [lx + 0.14, 1.68, lz + 0.14], metalMaterial)
      addBox([lx - 0.125, 1.492, lz - 0.125], [lx + 0.125, 1.5, lz + 0.125], lampMaterial)
      lights.push({
        origin: [lx - 0.125, 1.49, lz - 0.125],
        u: [0.25, 0, 0],
        v: [0, 0, 0.25],
        normal: [0, -1, 0],
        color: lampTone,
        intensity: 26 + brightness * 10,
        samples: fillSamples,
      })
    }
  }

  // Общий заполняющий свет с потолка — как рассеянный свет комнаты.
  const fillWidth = W * 0.7
  const fillDepth = D * 0.5
  lights.push({
    origin: [(W - fillWidth) * 0.5, H - 0.03, (D - fillDepth) * 0.5],
    u: [fillWidth, 0, 0],
    v: [0, 0, fillDepth],
    normal: [0, -1, 0],
    color: lightColor(warm),
    intensity: (0.55 + brightness * 0.9) * (1 - input.light.contrast * 0.45),
    samples: preview ? 2 : 3,
  })

  // Отражённый свет от пола: дешёвая замена полноценного расчёта переотражений.
  lights.push({
    origin: [W * 0.12, 0.06, D * 0.1],
    u: [W * 0.76, 0, 0],
    v: [0, 0, D * 0.7],
    normal: [0, 1, 0],
    color: lightColor(warm * 0.7),
    intensity: 0.8 + brightness * 1.0,
    samples: preview ? 2 : 3,
  })

  // --- Камера ---
  const cameraShift = variant === 1 ? 0.66 : variant === 2 ? -0.7 : -0.1
  const targetShift = variant === 1 ? -0.5 : variant === 2 ? 0.52 : 0.05
  const camera = input.camera ?? {
    position: [clamp(W * 0.5 + cameraShift, 0.45, W - 0.45), 1.58, 0.4] as [
      number,
      number,
      number,
    ],
    target: [clamp(W * 0.5 + targetShift, 0.4, W - 0.4), counterTop + 0.34, D] as [
      number,
      number,
      number,
    ],
    fov: variant === 1 ? 44 : 41,
  }

  const ambientTone = lightColor(warm)
  const ambientLevel = (0.045 + brightness * 0.045) * (1 - input.light.contrast * 0.5)

  const layout: KitchenLayout = buildLayout({
    room: { width: W, height: H, depth: D },
    counter: { height: Hc, depth: Dc },
    run: { start: runStart, end: runEnd },
    backsplashTop,
    upperTop,
    upperRuns,
    tallUnit: tallUnit
      ? { start: tallUnit[0], end: tallUnit[1], depth: Math.max(0.6, Dc), top: upperTop + 0.06 }
      : null,
    island: islandBounds,
    window: windowRect,
    appliances: input.options.appliances,
    hood: input.options.hood,
    hobCentre,
    sinkCentre,
    facadeLabel: input.facade.label ?? 'Фасад',
  })

  return {
    compositing,
    layout,
    boxes,
    materials,
    lights,
    camera,
    ambient: [
      ambientTone[0] * ambientLevel,
      ambientTone[1] * ambientLevel,
      ambientTone[2] * ambientLevel,
    ],
    exposure: 1.18 / (0.55 + 0.45 * brightness),
    contrast: input.light.contrast,
    grain: 0.32,
    seed: input.seed,
  }
}
