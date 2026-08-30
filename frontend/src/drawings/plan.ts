import { ACCENT, FILL, INK, THIN, dimensionH, dimensionV, line, rect, svgDocument, text } from './svg.ts'
import type { FurnitureLayout } from './types.ts'

/**
 * План помещения: вид сверху с расстановкой модулей и проходами.
 * По нему проверяют, что кухня встаёт в комнату и остаётся проход.
 */
export function renderPlan(layout: FurnitureLayout, title: string): string {
  const margin = { left: 92, right: 40, top: 54, bottom: 86 }
  const drawWidth = 860
  const scale = drawWidth / layout.room.width
  const drawHeight = layout.room.depth * scale
  const width = drawWidth + margin.left + margin.right
  const height = drawHeight + margin.top + margin.bottom

  // Дальняя стена сверху листа, глубина растёт вниз.
  const px = (x: number) => margin.left + x * scale
  const pz = (z: number) => margin.top + z * scale
  const parts: string[] = []

  parts.push(text(margin.left, 26, title, { size: 15, anchor: 'start', weight: 600 }))
  parts.push(text(margin.left, 42, 'План · вид сверху · размеры в мм', { size: 11, anchor: 'start', fill: THIN }))

  // Помещение.
  parts.push(rect(px(0), pz(0), drawWidth, drawHeight, { stroke: INK, strokeWidth: 2, fill: '#fbfaf8' }))
  parts.push(text(px(layout.room.width / 2), pz(0) - 8, 'дальняя стена', { size: 10, fill: THIN }))

  // Окно на дальней стене.
  if (layout.window) {
    parts.push(
      line(px(layout.window.x), pz(0), px(layout.window.x + layout.window.width), pz(0), {
        stroke: '#ffffff',
        strokeWidth: 5,
      }),
    )
    parts.push(
      line(px(layout.window.x), pz(0), px(layout.window.x + layout.window.width), pz(0), {
        stroke: THIN,
        strokeWidth: 1.4,
        dash: '6 3',
      }),
    )
  }

  // Нижний ряд вдоль основной стены.
  const baseModules = layout.modules
    .filter((module) => module.kind === 'base' && module.wall === 'main')
    .sort((a, b) => a.x - b.x)
  for (const module of baseModules) {
    parts.push(rect(px(module.x), pz(0), module.width * scale, module.depth * scale, { fill: FILL }))
    if (module.width * scale > 30) {
      parts.push(
        text(px(module.x + module.width / 2), pz(module.depth / 2) + 4, module.id, { size: 10, weight: 600 }),
      )
    }
  }

  // Нижний ряд вдоль боковой стены: глубина откладывается вдоль ширины
  // помещения, поэтому прямоугольник повёрнут.
  const sideModules = layout.modules
    .filter((module) => module.kind === 'base' && module.wall === 'side')
    .sort((a, b) => a.x - b.x)
  for (const module of sideModules) {
    parts.push(rect(px(0), pz(module.x), module.depth * scale, module.width * scale, { fill: FILL }))
    if (module.width * scale > 30) {
      parts.push(
        text(px(module.depth / 2), pz(module.x + module.width / 2) + 4, module.id, {
          size: 10,
          weight: 600,
        }),
      )
    }
  }

  // Пенал — глубже основного ряда.
  for (const module of layout.modules.filter((item) => item.kind === 'tall')) {
    parts.push(
      rect(px(module.x), pz(0), module.width * scale, module.depth * scale, {
        fill: '#e6e1d8',
        strokeWidth: 1.6,
      }),
    )
    parts.push(text(px(module.x + module.width / 2), pz(module.depth / 2) + 4, module.id, { size: 10, weight: 600 }))
  }

  // Остров.
  const island = layout.modules.filter((module) => module.kind === 'island').sort((a, b) => a.x - b.x)
  if (island.length > 0) {
    const first = island[0]
    const last = island[island.length - 1]
    const islandZ = layout.counter.depth + 900
    for (const module of island) {
      parts.push(rect(px(module.x), pz(islandZ), module.width * scale, module.depth * scale, { fill: FILL }))
      parts.push(
        text(px(module.x + module.width / 2), pz(islandZ + module.depth / 2) + 4, module.id, {
          size: 10,
          weight: 600,
        }),
      )
    }
    // Проход между фронтом и островом.
    parts.push(
      dimensionV(
        pz(layout.counter.depth),
        pz(islandZ),
        px((first.x + last.x + last.width) / 2),
        `${Math.round(islandZ - layout.counter.depth)} проход`,
      ),
    )
  }

  // Варочная панель и мойка условными знаками.
  for (const module of layout.modules.filter((item) => item.kind === 'appliance' && item.label === 'Варочная панель')) {
    const cx = px(module.x + module.width / 2)
    const cz = pz(layout.counter.depth / 2)
    parts.push(rect(cx - 26, cz - 18, 52, 36, { stroke: ACCENT, dash: '3 2' }))
    for (const [dx, dz] of [
      [-13, -9],
      [13, -9],
      [-13, 9],
      [13, 9],
    ]) {
      parts.push(`<circle cx="${(cx + dx).toFixed(1)}" cy="${(cz + dz).toFixed(1)}" r="5" fill="none" stroke="${ACCENT}" stroke-width="1"/>`)
    }
  }

  // Размеры.
  const chainZ = margin.top + drawHeight + 30
  for (const module of baseModules) {
    parts.push(dimensionH(px(module.x), px(module.x + module.width), chainZ, String(module.width)))
  }
  parts.push(dimensionH(px(0), px(layout.room.width), chainZ + 30, `${layout.room.width} (помещение)`, 11))
  parts.push(dimensionV(pz(0), pz(layout.counter.depth), margin.left - 30, String(layout.counter.depth)))
  parts.push(dimensionV(pz(0), pz(layout.room.depth), margin.left - 62, `${layout.room.depth} (глубина)`, 11))

  return svgDocument(width, height, parts.join(''), `${title} — план`)
}
