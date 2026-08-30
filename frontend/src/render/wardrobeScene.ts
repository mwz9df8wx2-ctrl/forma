import { buildWardrobeLayout } from '../drawings/wardrobe.ts'
import type { FurnitureLayout } from '../drawings/types.ts'
import { clamp, createPalette, lightColor } from './palette.ts'
import type { AreaLight, RenderBox, SceneInput, SceneSpec } from './types.ts'

/**
 * Сцена шкафа и тумбы.
 *
 * Геометрия своя, палитра и свет — общие с кухней: один артикул каталога
 * обязан выглядеть одинаково независимо от того, что из него делают.
 *
 * Одна секция рисуется открытой. Закрытый шкаф на картинке — это ровный
 * прямоугольник, по которому нельзя понять, что внутри; заказчик покупает
 * как раз наполнение.
 */
export function buildWardrobeScene(input: SceneInput): SceneSpec {
  const W = clamp(input.room.width, 2.4, 6.4)
  const H = clamp(input.room.height, 2.35, 3.5)
  const D = clamp(input.room.depth, 3.1, 5.2)
  const depth = clamp(input.counter.depth, 0.35, 0.8)

  const variant = ((input.variant % 3) + 3) % 3
  const preview = input.quality === 'preview'
  const warm = input.light.warmth
  const brightness = input.light.brightness
  const compositing = input.compositing === true
  const cabinet = input.category === 'cabinet'

  const palette = createPalette(input)
  const materials = palette.list
  const boxes: RenderBox[] = []
  const lights: AreaLight[] = []

  const addBox = (
    min: [number, number, number],
    max: [number, number, number],
    material: number,
  ) => {
    boxes.push({ min, max, material, inverted: false })
  }
  const addRoomBox = (
    min: [number, number, number],
    max: [number, number, number],
    material: number,
    inverted = false,
    shadowCatcher = false,
  ) => {
    boxes.push({ min, max, material, inverted, hidden: compositing, shadowCatcher })
  }

  // --- Оболочка помещения ---
  addRoomBox([-0.03, -0.2, -0.03], [W + 0.03, H + 0.2, D + 0.03], palette.wall, true)
  addRoomBox([-0.03, -0.12, -0.03], [W + 0.03, 0, D + 0.03], palette.floor, false, true)
  addRoomBox([-0.03, H, -0.03], [W + 0.03, H + 0.12, D + 0.03], palette.ceiling)

  // --- Габариты изделия ---
  const offset = 0.1
  const x0 = offset
  const x1 = Math.max(x0 + 0.6, W - offset)
  const height = cabinet ? Math.min(1.2, H - 0.2) : Math.min(2.6, H - 0.06)
  const plinth = 0.1
  // Антресоль есть только у высокого шкафа: у тумбы её негде разместить.
  const topBox = !cabinet && height > 2.2 ? 0.5 : 0
  const bodyTop = height - topBox
  const front = D - depth

  const layout: FurnitureLayout = buildWardrobeLayout({
    room: { width: W, height: H, depth: D },
    width: x1 - x0,
    height,
    depth,
    offset,
    hangingSections: cabinet ? 0 : 2,
    drawers: cabinet ? 3 : 4,
    topBox: topBox > 0,
    facadeLabel: input.facade.label ?? 'Фасад',
    category: cabinet ? 'cabinet' : 'wardrobe',
  })

  // Секции берём из той же раскладки, что уходит в чертёж: картинка не имеет
  // права показывать другое число дверец, чем спецификация.
  const sections = layout.modules
    .filter((module) => module.kind === 'tall')
    .map((module) => ({ x0: module.x / 1000, x1: (module.x + module.width) / 1000 }))
    .sort((a, b) => a.x0 - b.x0)

  // Открытой делаем секцию с полками, а не со штангой: полки читаются
  // на картинке лучше, чем висящая одежда, которой в сцене всё равно нет.
  const openIndex = sections.length > 1 ? sections.length - 1 : -1
  const open = openIndex >= 0 && !compositing ? sections[openIndex] : null

  // Цоколь.
  addBox([x0 + 0.05, 0, front + 0.075], [x1 - 0.05, plinth, D], palette.toe)

  // Корпус собирается из деталей, а не рисуется сплошным блоком: внутри
  // открытой секции должно быть видно наполнение, ради которого шкаф и берут.
  const panel = 0.018
  addBox([x0, plinth, D - panel], [x1, bodyTop, D], palette.carcass)
  addBox([x0, plinth, front], [x1, plinth + panel, D], palette.carcass)
  addBox([x0, bodyTop - panel, front], [x1, bodyTop, D], palette.carcass)
  for (const edge of [x0, x1]) {
    addBox([edge - panel * 0.5, plinth, front], [edge + panel * 0.5, bodyTop, D], palette.carcass)
  }
  for (const section of sections.slice(1)) {
    addBox(
      [section.x0 - panel * 0.5, plinth, front],
      [section.x0 + panel * 0.5, bodyTop, D],
      palette.shelf,
    )
  }

  // Фасады накладные: тонкий слой по переднему краю корпуса, как в цеху.
  // Открытая секция остаётся без дверцы.
  for (const [index, section] of sections.entries()) {
    if (open && index === openIndex) continue
    addBox(
      [section.x0, plinth, front - 0.019],
      [section.x1, bodyTop, front],
      cabinet ? palette.facadeBase : palette.facadeTall,
    )
  }

  // Антресоль отдельным рядом дверец.
  if (topBox > 0) {
    for (const section of sections) {
      addBox(
        [section.x0, bodyTop, front - 0.019],
        [section.x1, height, front],
        palette.facadeUpper,
      )
    }
    addBox([x0, bodyTop, front], [x1, height, D], palette.carcass)
  }

  // Наполнение открытой секции: полки, штанга и ящики читаются на картинке.
  if (open) {
    const inner = { x0: open.x0 + 0.018, x1: open.x1 - 0.018 }
    const shelves = layout.modules.filter(
      (module) =>
        module.label === 'Полка секции' &&
        module.x / 1000 >= open.x0 - 0.001 &&
        module.x / 1000 <= open.x1,
    )
    for (const shelf of shelves) {
      const y = shelf.y / 1000
      addBox([inner.x0, y, front + 0.03], [inner.x1, y + 0.018, D - 0.02], palette.carcass)
    }
    if (shelves.length === 0) {
      // Секция со штангой: рисуем саму штангу, по ней сверлят держатели.
      const y = bodyTop - 0.12
      addBox([inner.x0, y, front + 0.24], [inner.x1, y + 0.028, front + 0.268], palette.metal)
    }
  }

  // --- Свет ---
  // Окно на боковой стене: шкаф стоит у дальней, и окно за ним не поместится.
  // Боковой свет вдобавок лучше показывает рельеф фасада.
  const windowRect = input.options.windows
    ? { z0: D * 0.3, z1: D * 0.3 + 1.5, y0: 0.9, y1: Math.min(H - 0.35, 2.1) }
    : null

  if (windowRect) {
    if (!compositing) {
      addRoomBox(
        [0.02, windowRect.y0, windowRect.z0],
        [0.05, windowRect.y1, windowRect.z1],
        palette.window,
      )
    }
    lights.push({
      origin: [0.055, windowRect.y0, windowRect.z0],
      u: [0, 0, windowRect.z1 - windowRect.z0],
      v: [0, windowRect.y1 - windowRect.y0, 0],
      normal: [1, 0, 0],
      color: palette.sky,
      intensity: 13 + brightness * 15,
      samples: preview ? 2 : 4,
    })
  }

  // Общий заполняющий свет с потолка.
  const fillWidth = W * 0.7
  const fillDepth = D * 0.5
  lights.push({
    origin: [(W - fillWidth) * 0.5, H - 0.03, (D - fillDepth) * 0.5],
    u: [fillWidth, 0, 0],
    v: [0, 0, fillDepth],
    normal: [0, -1, 0],
    color: lightColor(warm),
    intensity: (0.75 + brightness * 1.1) * (1 - input.light.contrast * 0.45),
    samples: preview ? 2 : 3,
  })

  // Отражённый свет от пола.
  lights.push({
    origin: [W * 0.12, 0.06, D * 0.1],
    u: [W * 0.76, 0, 0],
    v: [0, 0, D * 0.7],
    normal: [0, 1, 0],
    color: lightColor(warm * 0.7),
    intensity: 0.8 + brightness * 1.0,
    samples: preview ? 2 : 3,
  })

  // Подсветка открытой секции: она и в жизни ставится, и на картинке
  // объясняет, что внутри.
  if (open && input.options.ledLight) {
    lights.push({
      origin: [open.x0 + 0.04, bodyTop - 0.05, front + 0.06],
      u: [open.x1 - open.x0 - 0.08, 0, 0],
      v: [0, 0, depth - 0.12],
      normal: [0, -1, 0],
      color: palette.lampTone,
      intensity: 6 + brightness * 4,
      samples: preview ? 1 : 2,
    })
  }

  // --- Камера ---
  // Смотрим на изделие с середины комнаты: шкаф читается фронтально,
  // а лёгкий сдвиг по вариантам показывает глубину.
  const shift = variant === 1 ? 0.5 : variant === 2 ? -0.5 : 0
  // Шкаф выше кухонного фронта и стоит у дальней стены, поэтому объектив
  // шире кухонного: иначе в кадр не попадают ни пол, ни верх изделия.
  const distance = front - 0.35
  const needed = height + 0.7
  const fov = clamp(
    (2 * Math.atan(needed / 2 / Math.max(1.2, distance)) * 180) / Math.PI,
    38,
    72,
  )
  const camera = input.camera ?? {
    position: [clamp(W * 0.5 + shift, 0.5, W - 0.5), 1.5, 0.35] as [number, number, number],
    target: [clamp(W * 0.5 + shift * 0.35, 0.4, W - 0.4), height * 0.46, D] as [
      number,
      number,
      number,
    ],
    fov: variant === 1 ? fov + 3 : fov,
  }

  const ambientTone = lightColor(warm)
  const ambientLevel = (0.05 + brightness * 0.05) * (1 - input.light.contrast * 0.5)

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
    exposure: 1,
    contrast: input.light.contrast,
    grain: 0.022,
    seed: input.seed,
  }
}
