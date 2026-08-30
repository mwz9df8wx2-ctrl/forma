import { isWallMounted } from '../drawings/hardware.ts'
import { buildObjectLayout, type ObjectCategory } from '../drawings/object.ts'
import type { FurnitureLayout, FurnitureModule } from '../drawings/types.ts'
import { clamp, createPalette, lightColor } from './palette.ts'
import { buildViewpoint, viewAngleForVariant } from './viewpoint.ts'
import type { AreaLight, RenderBox, SceneInput, SceneSpec } from './types.ts'

/**
 * Сцена корпусной мебели: шкаф, тумба, ТВ-зона, стенка в гостиную.
 *
 * Геометрия строится по модулям раскладки, а не пишется под каждую категорию
 * заново. Поэтому картинка не может показать другое число дверец, чем уходит
 * в спецификацию: и то, и другое читается из одного списка модулей.
 *
 * Кухня осталась отдельной сценой: у неё два яруса, столешница, фартук и
 * техника — правил столько, что общий обход модулей вышел бы сложнее двух
 * отдельных построений.
 */

const PANEL = 0.018

function layoutFor(input: SceneInput, W: number, H: number, D: number): FurnitureLayout {
  return buildObjectLayout({
    category: (input.category ?? 'wardrobe') as ObjectCategory,
    room: { width: W, height: H, depth: D },
    depth: clamp(input.counter.depth, 0.3, 0.8),
    facadeLabel: input.facade.label ?? 'Фасад',
  })
}

export function buildObjectScene(input: SceneInput): SceneSpec {
  const W = clamp(input.room.width, 2.4, 6.4)
  const H = clamp(input.room.height, 2.35, 3.5)
  const D = clamp(input.room.depth, 3.1, 5.2)

  const variant = ((input.variant % 3) + 3) % 3
  const preview = input.quality === 'preview'
  const warm = input.light.warmth
  const brightness = input.light.brightness
  const compositing = input.compositing === true

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

  addRoomBox([-0.03, -0.2, -0.03], [W + 0.03, H + 0.2, D + 0.03], palette.wall, true)
  addRoomBox([-0.03, -0.12, -0.03], [W + 0.03, 0, D + 0.03], palette.floor, false, true)
  addRoomBox([-0.03, H, -0.03], [W + 0.03, H + 0.12, D + 0.03], palette.ceiling)

  const layout = layoutFor(input, W, H, D)

  // В ванной стена за мебелью выложена плиткой. Без неё сцена выглядит
  // как шкаф в жилой комнате, а не как ванная. Панель ставим перед стеной,
  // а не в её плоскости: совпадающие грани дают полосы на рендере.
  if (layout.category === 'bathroom' && !compositing) {
    addBox([0, 0, D - 0.035], [W, Math.min(H, 2.4), D - 0.012], palette.tile)
  }
  const metre = (value: number) => value / 1000

  const facadeFor = (module: FurnitureModule) => {
    // Зеркальная дверца — не крашеный фасад: без своего материала
    // зеркальный шкаф выглядит как обычная створка.
    if (module.surface === 'mirror') return palette.mirror
    if (module.surface === 'ceramic') return palette.ceramic
    return module.kind === 'upper'
      ? palette.facadeUpper
      : module.kind === 'tall'
        ? palette.facadeTall
        : palette.facadeBase
  }

  // Открытые секции, из которых потом собираются вертикальные перегородки.
  const openCells: Array<{ x0: number; x1: number; y0: number; y1: number; front: number }> = []

  let lowestBody = Number.POSITIVE_INFINITY
  let highest = 0
  let leftmost = W
  let rightmost = 0

  for (const module of layout.modules) {
    const x0 = metre(module.x)
    const x1 = metre(module.x + module.width)
    const y0 = metre(module.y)
    const y1 = metre(module.y + module.height)
    const depth = metre(module.depth)
    const front = D - depth

    leftmost = Math.min(leftmost, x0)
    rightmost = Math.max(rightmost, x1)
    highest = Math.max(highest, y1)

    if (module.kind === 'appliance') {
      // Телевизор, зеркало, раковина — не изделия цеха, но именно они
      // отвечают на главный вопрос заказчика: как это будет выглядеть.
      const material =
        module.surface === 'mirror'
          ? palette.mirror
          : module.surface === 'ceramic'
            ? palette.ceramic
            : palette.darkGlass
      addBox([x0, y0, D - depth], [x1, y1, D - 0.008], material)
      continue
    }

    if (module.kind === 'shelf') {
      addBox([x0, y0, front], [x1, y1, D], palette.carcass)
      continue
    }

    if (module.internal) {
      // Внутренний блок: своих боковин у него нет, виден только фасад.
      addBox([x0, y0, front - PANEL], [x1, y1, front], facadeFor(module))
      continue
    }

    // Цоколь считаем только по напольным модулям: под подвесной тумбой
    // цоколя нет, иначе он вырос бы до полуметра.
    if (!isWallMounted(module)) lowestBody = Math.min(lowestBody, y0)

    if (module.doors > 0) {
      // Закрытая секция: внутренности всё равно не видно, корпус рисуем целиком.
      addBox([x0, y0, front], [x1, y1, D], palette.carcass)
      addBox([x0, y0, front - PANEL], [x1, y1, front], facadeFor(module))
      continue
    }

    // Открытая секция: корпус собирается из деталей, иначе полки внутри
    // окажутся замурованы в сплошной блок.
    addBox([x0, y0, D - PANEL], [x1, y1, D], palette.carcass)
    addBox([x0, y0, front], [x1, y0 + PANEL, D], palette.carcass)
    addBox([x0, y1 - PANEL, front], [x1, y1, D], palette.carcass)
    openCells.push({ x0, x1, y0, y1, front })
  }

  /**
   * Вертикальные перегородки. Между соседними ячейками стойка одна, а не две
   * встык: иначе на картинке она вдвое толще, чем в раскрое. Раскладки при
   * этом разные — у стеллажа между ячейками оставлен зазор под стойку,
   * у шкафа секции идут вплотную, — поэтому обе разбираются здесь.
   */
  openCells.sort((a, b) => a.x0 - b.x0)
  for (const [index, cell] of openCells.entries()) {
    const previous = openCells[index - 1]
    const adjacent =
      previous !== undefined &&
      cell.x0 - previous.x1 <= 0.04 &&
      Math.min(previous.y1, cell.y1) - Math.max(previous.y0, cell.y0) > 0.2

    const left = adjacent
      ? // Зазор между ячейками — это и есть стойка. Если зазора нет,
        // ячейки идут вплотную, и стойка встаёт по их общей границе.
        cell.x0 - previous.x1 > 0.001
        ? { from: previous.x1, to: cell.x0 }
        : { from: cell.x0 - PANEL / 2, to: cell.x0 + PANEL / 2 }
      : { from: cell.x0 - PANEL, to: cell.x0 }

    const y0 = adjacent ? Math.min(previous.y0, cell.y0) : cell.y0
    const y1 = adjacent ? Math.max(previous.y1, cell.y1) : cell.y1
    const front = adjacent ? Math.min(previous.front, cell.front) : cell.front

    addBox([left.from, y0, front], [left.to, y1, D], palette.carcass)

    // Правая боковина рисуется только у последней ячейки ряда: у остальных
    // её роль играет стойка следующей.
    const next = openCells[index + 1]
    const continues =
      next !== undefined &&
      next.x0 - cell.x1 <= 0.04 &&
      Math.min(next.y1, cell.y1) - Math.max(next.y0, cell.y0) > 0.2
    if (!continues) {
      addBox([cell.x1, cell.y0, cell.front], [cell.x1 + PANEL, cell.y1, D], palette.carcass)
    }
  }

  // Цоколь под напольными модулями.
  if (Number.isFinite(lowestBody) && lowestBody > 0.02) {
    const plinthDepth = clamp(input.counter.depth, 0.3, 0.8)
    addBox(
      [leftmost + 0.05, 0, D - plinthDepth + 0.06],
      [rightmost - 0.05, lowestBody, D],
      palette.toe,
    )
  }

  // --- Свет ---
  // Окно на боковой стене: изделие стоит у дальней, за ним окну места нет.
  const windowRect = input.options.windows
    ? { z0: D * 0.28, z1: D * 0.28 + 1.5, y0: 0.9, y1: Math.min(H - 0.35, 2.1) }
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

  lights.push({
    origin: [W * 0.12, 0.06, D * 0.1],
    u: [W * 0.76, 0, 0],
    v: [0, 0, D * 0.7],
    normal: [0, 1, 0],
    color: lightColor(warm * 0.7),
    intensity: 0.8 + brightness * 1.0,
    samples: preview ? 2 : 3,
  })

  // Подсветка открытых секций: её и в жизни ставят, и на картинке она
  // объясняет, что внутри.
  const openModule = layout.modules.find((module) => module.open && module.kind !== 'upper')
  if (openModule && input.options.ledLight) {
    const x0 = metre(openModule.x)
    const x1 = metre(openModule.x + openModule.width)
    const top = metre(openModule.y + openModule.height)
    const depth = metre(openModule.depth)
    lights.push({
      origin: [x0 + 0.04, top - 0.05, D - depth + 0.06],
      u: [Math.max(0.1, x1 - x0 - 0.08), 0, 0],
      v: [0, 0, Math.max(0.1, depth - 0.12)],
      normal: [0, -1, 0],
      color: palette.lampTone,
      intensity: 6 + brightness * 4,
      samples: preview ? 1 : 2,
    })
  }

  // --- Камера ---
  // Кадр строится по габариту изделия: у стенки и у шкафа разная высота,
  // и один фиксированный объектив обрезал бы то одно, то другое.
  const distance = Math.max(1.2, D - clamp(input.counter.depth, 0.3, 0.8) - 0.35)
  const needed = Math.max(1.6, highest + 0.7)
  const fov = clamp((2 * Math.atan(needed / 2 / distance) * 180) / Math.PI, 38, 72)

  const camera =
    input.camera ??
    buildViewpoint({
      angle: viewAngleForVariant(variant, input.viewAngle),
      roomWidth: W,
      roomDepth: D,
      eyeDepth: 0.35,
      eyeHeight: 1.5,
      targetHeight: Math.max(0.7, highest * 0.48),
      fov,
    })

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
