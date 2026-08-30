/**
 * Проверка разбора фотографии: рендерим сцену с известной камерой,
 * прогоняем анализ и сравниваем с истинными значениями.
 *
 * Запуск: node scripts/test-analysis.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './png.mjs'
import { buildScene } from '../src/render/scene.ts'
import { renderImage } from '../src/render/index.ts'
import { analyzePhoto } from '../src/analysis/analyze.ts'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../analysis-debug.png')

const base = {
  room: { width: 4.2, height: 2.7, depth: 4.83 },
  counter: { height: 0.9, depth: 0.6 },
  facade: { color: '#C8B291', pattern: 'veneer', roughness: 0.5, handles: 'bar', frame: false },
  countertop: { color: '#B6B2AC', pattern: 'stone', roughness: 0.3 },
  wall: '#EFEDE8',
  floor: '#B98D5B',
  accent: '#B98D5B',
  light: { warmth: 0.55, brightness: 0.85, contrast: 0.4 },
  options: { island: false, appliances: true, hood: false, ledLight: false, windows: true, openShelves: false },
  variant: 0,
  seed: 7,
  quality: 'preview',
}

const width = 512
const height = 341

const scene = buildScene(base)
const rgba = renderImage(scene, width, height, { aoSamples: 2 })

// Истинная линия горизонта по камере сцены.
const camera = scene.camera
const fx = camera.target[0] - camera.position[0]
const fy = camera.target[1] - camera.position[1]
const fz = camera.target[2] - camera.position[2]
const flen = Math.hypot(fx, fy, fz)
const f = [fx / flen, fy / flen, fz / flen]
let r = [f[2], 0, -f[0]]
const rlen = Math.hypot(r[0], r[1], r[2]) || 1
r = r.map((v) => v / rlen)
const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]]
const halfH = Math.tan(((camera.fov * Math.PI) / 180) * 0.5)
const py = -f[1] / u[1]
const trueHorizon = 0.5 * (1 - py / halfH)

const analysis = analyzePhoto(rgba, width, height)

const pct = (v) => (v === null || v === undefined ? '—' : (v * 100).toFixed(1) + '%')
console.log('')
console.log('  Истина    горизонт:', pct(trueHorizon))
console.log('  Найдено   горизонт:', pct(analysis.horizonY), ' точка схода:', analysis.vanishing ? `${analysis.vanishing.x.toFixed(0)},${analysis.vanishing.y.toFixed(0)}` : 'нет')
console.log('  Пол:', pct(analysis.floorLineY), ' потолок:', pct(analysis.ceilingLineY), ' столешница:', pct(analysis.counterLineY))
console.log('  Стена по X:', analysis.wallSpan ? `${pct(analysis.wallSpan.left)}…${pct(analysis.wallSpan.right)}` : 'не найдена')
console.log('  Окон:', analysis.windows.length, analysis.windows.map((w) => `${pct(w.x0)}…${pct(w.x1)} (сила ${w.strength.toFixed(2)})`).join(', '))
console.log('  Свет: сторона', analysis.light.directionX.toFixed(2), ' тепло', analysis.light.warmth.toFixed(2), ' яркость', analysis.light.brightness.toFixed(2), ' контраст', analysis.light.contrast.toFixed(2))
console.log('  Цвета: стена', analysis.colors.wall, ' пол', analysis.colors.floor, ' потолок', analysis.colors.ceiling)
console.log('  Доверие:', analysis.confidence.toFixed(2))
console.log('')

// Отладочная разметка поверх кадра.
const debug = new Uint8ClampedArray(rgba)
const line = (y, color) => {
  if (y === null || y === undefined) return
  const row = Math.round(y * height)
  if (row < 0 || row >= height) return
  for (let x = 0; x < width; x += 1) {
    const o = (row * width + x) * 4
    debug[o] = color[0]
    debug[o + 1] = color[1]
    debug[o + 2] = color[2]
  }
}
const column = (x, color) => {
  const col = Math.round(x * width)
  if (col < 0 || col >= width) return
  for (let y = 0; y < height; y += 1) {
    const o = (y * width + col) * 4
    debug[o] = color[0]
    debug[o + 1] = color[1]
    debug[o + 2] = color[2]
  }
}
const box = (w, color) => {
  for (let x = Math.round(w.x0 * width); x < Math.round(w.x1 * width); x += 1) {
    for (const y of [Math.round(w.y0 * height), Math.round(w.y1 * height) - 1]) {
      if (y < 0 || y >= height) continue
      const o = (y * width + x) * 4
      debug[o] = color[0]; debug[o + 1] = color[1]; debug[o + 2] = color[2]
    }
  }
  for (let y = Math.round(w.y0 * height); y < Math.round(w.y1 * height); y += 1) {
    for (const x of [Math.round(w.x0 * width), Math.round(w.x1 * width) - 1]) {
      if (x < 0 || x >= width) continue
      const o = (y * width + x) * 4
      debug[o] = color[0]; debug[o + 1] = color[1]; debug[o + 2] = color[2]
    }
  }
}

line(trueHorizon, [255, 0, 0])
line(analysis.horizonY, [255, 160, 0])
line(analysis.floorLineY, [0, 120, 255])
line(analysis.ceilingLineY, [0, 220, 120])
line(analysis.counterLineY, [200, 0, 200])
if (analysis.wallSpan) { column(analysis.wallSpan.left, [255, 255, 0]); column(analysis.wallSpan.right, [255, 255, 0]) }
analysis.windows.forEach((w) => box(w, [0, 255, 255]))

writeFileSync(OUT, encodePng(debug, width, height))
console.log('  Разметка: analysis-debug.png (красный — истинный горизонт, оранжевый — найденный,')
console.log('  синий — пол, зелёный — потолок, фиолетовый — столешница, жёлтый — углы, голубой — окна)')
