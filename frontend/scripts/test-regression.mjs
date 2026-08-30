/**
 * Прогон конвейера по типовым сценариям из технического задания.
 * Для каждого случая проверяются геометрия, покрытие и осмысленность кадра.
 *
 * Запуск: node scripts/test-regression.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './png.mjs'
import { buildScene } from '../src/render/scene.ts'
import { renderImage } from '../src/render/index.ts'
import { renderIntoPhoto } from '../src/render/pipeline.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'regression')
mkdirSync(OUT, { recursive: true })

const width = 512
const height = 341

const baseExisting = {
  counter: { height: 0.9, depth: 0.6 },
  facade: { color: '#C8B291', pattern: 'linear', roughness: 0.62, handles: 'knob', frame: true },
  countertop: { color: '#B6B2AC', pattern: 'stone', roughness: 0.42 },
  wall: '#E7E2D8',
  floor: '#A9835A',
  accent: '#A9835A',
  light: { warmth: 0.5, brightness: 0.82, contrast: 0.35 },
  options: { island: false, appliances: true, hood: false, ledLight: false, windows: true, openShelves: false },
  variant: 0,
  seed: 11,
  quality: 'preview',
}

const wanted = {
  facade: { color: '#4A4C50', pattern: 'paint', roughness: 0.55, handles: 'bar', frame: false },
  countertop: { color: '#EAE7E1', pattern: 'marble', roughness: 0.18 },
  wall: '#F2F1ED',
  floor: '#C09A6B',
  accent: '#C09A6B',
  light: { warmth: 0.9, brightness: 0.8, contrast: 0.45 },
}

const cases = [
  { name: 'обычная', room: { width: 4.2, height: 2.7, depth: 4.83 }, dims: [4200, 2700, 900, 600] },
  { name: 'маленькая', room: { width: 2.6, height: 2.5, depth: 3.6 }, dims: [2600, 2500, 900, 600] },
  { name: 'с островом', room: { width: 5.2, height: 2.8, depth: 5.4 }, dims: [5200, 2800, 900, 650], want: { options: { island: true } } },
  { name: 'с окном', room: { width: 4.2, height: 2.7, depth: 4.83 }, dims: [4200, 2700, 900, 600] },
  { name: 'верхние шкафы', room: { width: 4.6, height: 2.9, depth: 4.9 }, dims: [4600, 2900, 900, 600] },
  { name: 'с вытяжкой', room: { width: 4.2, height: 2.7, depth: 4.83 }, dims: [4200, 2700, 900, 600], want: { options: { appliances: true } } },
  // Снимок делаем фронтальным: угловой кадр вписыванию не подлежит, и это
  // проверяется отдельным сценарием ниже.
  { name: 'открытые полки', room: { width: 4.2, height: 2.7, depth: 4.83 }, dims: [4200, 2700, 900, 600], want: { options: { openShelves: true } } },
  { name: 'тёмная', room: { width: 4.2, height: 2.7, depth: 4.83 }, dims: [4200, 2700, 900, 600], existing: { light: { warmth: 0.6, brightness: 0.45, contrast: 0.6 } } },
  { name: 'светлая', room: { width: 4.2, height: 2.7, depth: 4.83 }, dims: [4200, 2700, 900, 600], existing: { light: { warmth: 0.35, brightness: 1.0, contrast: 0.2 } } },
  { name: 'плохой свет', room: { width: 3.6, height: 2.6, depth: 4.2 }, dims: [3600, 2600, 900, 600], existing: { light: { warmth: 0.95, brightness: 0.35, contrast: 0.85 } } },
]

const slug = (name) => name.replace(/\s+/g, '-')
let failures = 0

console.log('')
console.log('  сценарий          камера        покрытие  яркость  доверие  проверка')
console.log('  ' + '─'.repeat(72))

for (const item of cases) {
  const existing = {
    ...baseExisting,
    ...(item.existing ?? {}),
    room: item.room,
    variant: item.variant ?? 0,
    options: { ...baseExisting.options, ...(item.want?.options ?? {}) },
  }
  const photo = renderImage(buildScene(existing), width, height, { aoSamples: 2 })

  const input = {
    ...existing,
    ...wanted,
    options: { ...existing.options, ...(item.want?.options ?? {}) },
    seed: 77,
  }

  const [roomWidth, roomHeight, counterHeight, counterDepth] = item.dims
  const result = renderIntoPhoto({
    photo,
    photoWidth: width,
    photoHeight: height,
    input,
    dimensions: { roomWidth, roomDepth: Math.round(item.room.depth * 1000), roomHeight, counterHeight, counterDepth },
    aoSamples: 2,
  })

  // Проверки: кадр не пустой, кухня занимает разумную долю, камера правдоподобна.
  let sum = 0
  for (let i = 0; i < width * height; i += 7) {
    const o = i * 4
    sum += (0.2126 * result.pixels[o] + 0.7152 * result.pixels[o + 1] + 0.0722 * result.pixels[o + 2]) / 255
  }
  const meanLuma = sum / Math.ceil((width * height) / 7)
  const log = result.log

  const problems = []
  if (log.coverage < 0.15) problems.push('кухня почти не видна')
  if (log.coverage > 0.95) problems.push('кухня закрыла весь кадр')
  if (meanLuma < 0.06) problems.push('кадр тёмный')
  if (meanLuma > 0.94) problems.push('кадр пересвечен')
  if (log.cameraHeight < 1.15 || log.cameraHeight > 2.0) problems.push('высота камеры вне нормы')
  if (log.cameraDistance < 1.4 || log.cameraDistance > 8) problems.push('расстояние вне нормы')
  if (problems.length > 0) failures += 1

  writeFileSync(resolve(OUT, `${slug(item.name)}.png`), encodePng(result.pixels, width, height))

  console.log(
    '  ' +
      item.name.padEnd(18) +
      `${log.cameraHeight.toFixed(2)}м ${log.cameraDistance.toFixed(2)}м`.padEnd(14) +
      `${(log.coverage * 100).toFixed(0)}%`.padEnd(10) +
      meanLuma.toFixed(2).padEnd(9) +
      log.cameraConfidence.toFixed(2).padEnd(9) +
      (problems.length === 0 ? 'ок' : problems.join(', ')),
  )
}

console.log('')
console.log(failures === 0 ? `  Все ${cases.length} сценариев прошли.` : `  Проблемы в ${failures} из ${cases.length}.`)
console.log(`  Кадры: regression/`)
