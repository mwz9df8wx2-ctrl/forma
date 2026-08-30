import { ACCENT, FILL, INK, THIN, dimensionH, dimensionV, line, rect, svgDocument, text } from './svg.ts'
import type { KitchenLayout } from './types.ts'

/**
 * Развёртка по стене: фронтальный вид кухни с размерами модулей.
 * Это основной лист для сборки — по нему считают фасады и присадку.
 */
export function renderElevation(layout: KitchenLayout, title: string): string {
  const margin = { left: 92, right: 40, top: 54, bottom: 86 }
  const drawWidth = 940
  const scale = drawWidth / layout.room.width
  const drawHeight = layout.room.height * scale
  const width = drawWidth + margin.left + margin.right
  const height = drawHeight + margin.top + margin.bottom

  // Мировые координаты (мм) → координаты листа.
  const px = (x: number) => margin.left + x * scale
  const py = (y: number) => margin.top + drawHeight - y * scale
  const parts: string[] = []

  parts.push(text(margin.left, 26, title, { size: 15, anchor: 'start', weight: 600 }))
  parts.push(text(margin.left, 42, 'Развёртка по стене · размеры в мм', { size: 11, anchor: 'start', fill: THIN }))

  // Стена и пол.
  parts.push(rect(px(0), py(layout.room.height), drawWidth, drawHeight, { stroke: THIN, fill: '#fbfaf8' }))
  parts.push(line(px(0) - 14, py(0), px(layout.room.width) + 14, py(0), { strokeWidth: 2 }))

  // Окно.
  if (layout.window) {
    const w = layout.window
    parts.push(
      rect(px(w.x), py(w.y + w.height), w.width * scale, w.height * scale, {
        stroke: THIN,
        fill: '#ffffff',
        dash: '5 3',
      }),
    )
    parts.push(text(px(w.x + w.width / 2), py(w.y + w.height / 2), 'окно', { size: 10, fill: THIN }))
  }

  // Фартук.
  parts.push(
    rect(
      px(layout.run.start),
      py(layout.backsplash.top),
      (layout.run.end - layout.run.start) * scale,
      (layout.backsplash.top - layout.counter.height) * scale,
      { stroke: THIN, fill: '#f7f5f1' },
    ),
  )

  const drawModule = (module: KitchenLayout['modules'][number]) => {
    const x = px(module.x)
    const y = py(module.y + module.height)
    const w = module.width * scale
    const h = module.height * scale
    if (w < 2 || h < 2) return

    const isAppliance = module.kind === 'appliance'
    const isShelf = module.kind === 'shelf'
    parts.push(
      rect(x, y, w, h, {
        stroke: isAppliance ? ACCENT : INK,
        fill: isShelf ? '#ece7de' : isAppliance ? '#ffffff' : FILL,
        strokeWidth: isAppliance ? 1 : 1.3,
        dash: isAppliance ? '4 3' : undefined,
      }),
    )

    // Разбивка на дверцы.
    for (let i = 1; i < module.doors; i += 1) {
      const dx = x + (w / module.doors) * i
      parts.push(line(dx, y + 2, dx, y + h - 2, { stroke: THIN, strokeWidth: 0.8 }))
    }

    if (h > 26 && w > 30) {
      parts.push(text(x + w / 2, y + h / 2 + 4, module.id, { size: 11, weight: 600 }))
    }
  }

  for (const module of layout.modules) {
    if (module.kind === 'island') continue
    drawModule(module)
  }

  // Столешница поверх нижнего ряда.
  parts.push(
    rect(
      px(layout.run.start) - 3,
      py(layout.counter.height),
      (layout.run.end - layout.run.start) * scale + 6,
      layout.counter.thickness * scale,
      { fill: '#e2ded6', stroke: INK, strokeWidth: 1.3 },
    ),
  )

  // Размерная цепочка по нижнему ряду.
  const baseModules = layout.modules
    .filter((module) => module.kind === 'base')
    .sort((a, b) => a.x - b.x)
  const chainY = margin.top + drawHeight + 30
  for (const module of baseModules) {
    parts.push(dimensionH(px(module.x), px(module.x + module.width), chainY, String(module.width)))
  }
  parts.push(
    dimensionH(px(0), px(layout.room.width), chainY + 30, `${layout.room.width} (помещение)`, 11),
  )

  // Высоты слева.
  parts.push(dimensionV(py(layout.counter.height), py(0), margin.left - 30, String(layout.counter.height)))
  parts.push(
    dimensionV(py(layout.backsplash.top), py(layout.counter.height), margin.left - 30, String(layout.backsplash.top - layout.counter.height)),
  )
  const upper = layout.modules.find((module) => module.kind === 'upper')
  if (upper) {
    parts.push(dimensionV(py(upper.y + upper.height), py(upper.y), margin.left - 30, String(upper.height)))
  }
  parts.push(dimensionV(py(layout.room.height), py(0), margin.left - 62, `${layout.room.height} (потолок)`, 11))

  return svgDocument(width, height, parts.join(''), `${title} — развёртка`)
}
