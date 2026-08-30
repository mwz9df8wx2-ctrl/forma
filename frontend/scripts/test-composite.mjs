/**
 * Проверка вписывания кухни в фотографию.
 * Снимок «как есть» имитируем рендером старой кухни, затем прогоняем конвейер.
 *
 * Запуск: node scripts/test-composite.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './png.mjs'
import { buildScene } from '../src/render/scene.ts'
import { renderImage } from '../src/render/index.ts'
import { renderIntoPhoto } from '../src/render/pipeline.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const width = 640
const height = 427

// --- «Фотография» существующей кухни ---
const existing = {
  room: { width: 4.2, height: 2.7, depth: 4.83 },
  counter: { height: 0.9, depth: 0.6 },
  facade: { color: '#C8B291', pattern: 'linear', roughness: 0.62, handles: 'knob', frame: true },
  countertop: { color: '#B6B2AC', pattern: 'stone', roughness: 0.42 },
  wall: '#E7E2D8',
  floor: '#A9835A',
  accent: '#A9835A',
  light: { warmth: 0.45, brightness: 0.8, contrast: 0.35 },
  options: { island: false, appliances: true, hood: false, ledLight: false, windows: true, openShelves: false },
  variant: 0,
  seed: 21,
  quality: 'preview',
}

console.time('снимок')
const photo = renderImage(buildScene(existing), width, height, { aoSamples: 2 })
console.timeEnd('снимок')
writeFileSync(resolve(root, 'composite-before.png'), encodePng(photo, width, height))

// --- Новая кухня, вписанная в этот снимок ---
const wanted = {
  ...existing,
  facade: { color: '#4A4C50', pattern: 'paint', roughness: 0.55, handles: 'bar', frame: false },
  countertop: { color: '#EAE7E1', pattern: 'marble', roughness: 0.18 },
  accent: '#C09A6B',
  light: { warmth: 0.9, brightness: 0.8, contrast: 0.45 },
  options: { ...existing.options, island: false, ledLight: true },
  seed: 42,
}

console.time('вписывание')
const result = renderIntoPhoto({
  photo,
  photoWidth: width,
  photoHeight: height,
  input: wanted,
  dimensions: { roomWidth: 4200, roomDepth: 3600, roomHeight: 2700, counterHeight: 900, counterDepth: 600 },
  aoSamples: 3,
})
console.timeEnd('вписывание')

writeFileSync(resolve(root, 'composite-after.png'), encodePng(result.pixels, width, height))

// Промежуточный кадр: комната без прежней мебели. По нему видно, что именно
// сняли и чем закрасили — самая частая причина плохого композита.
const { eraseFurniture } = await import('../src/analysis/erase.ts')
const plate = eraseFurniture(photo, width, height, result.analysis)
writeFileSync(resolve(root, 'composite-plate.png'), encodePng(plate.pixels, width, height))
console.log(
  `  снято прежней мебели: ${(plate.erasedShare * 100).toFixed(1)}% кадра` +
    (plate.reliable ? '' : ` (ненадёжно: ${plate.reason})`),
)

// Диагностика: маска покрытия новой кухней.
if (process.env.PIPELINE_DEBUG === '1' && result.alphaMask) {
  const mask = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    const v = result.alphaMask[i] * 255
    mask[i * 4] = v; mask[i * 4 + 1] = v; mask[i * 4 + 2] = v; mask[i * 4 + 3] = 255
  }
  writeFileSync(resolve(root, 'composite-mask.png'), encodePng(mask, width, height))
  console.log('  маска: composite-mask.png')
}

const log = result.log
console.log('')
console.log('  камера: высота', log.cameraHeight.toFixed(2), 'м, расстояние', log.cameraDistance.toFixed(2), 'м, угол', log.fov.toFixed(1) + '°')
console.log('  источник:', log.cameraSource, ' доверие камеры', log.cameraConfidence.toFixed(2), ' доверие анализа', log.analysisConfidence.toFixed(2))
console.log('  кухня занимает', (log.coverage * 100).toFixed(1) + '% кадра, экспозиция ×' + log.exposureGain.toFixed(2))
if (log.notes.length) console.log('  заметки:', log.notes.join('; '))
console.log('')
console.log('  Истина: высота 1.58 м, расстояние 4.43 м, угол 41°')
console.log('  Вписано:', log.composited ? 'да' : `нет — ${log.reason}`)

// --- Тот же кадр, снятый под углом: вписывание должно быть отклонено ---
function shear(pixels, w, h, degrees) {
  const out = new Uint8ClampedArray(pixels.length)
  const slope = Math.tan((degrees * Math.PI) / 180)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sy = Math.min(h - 1, Math.max(0, Math.round(y + (x - w / 2) * slope)))
      const from = (sy * w + x) * 4
      const to = (y * w + x) * 4
      out[to] = pixels[from]
      out[to + 1] = pixels[from + 1]
      out[to + 2] = pixels[from + 2]
      out[to + 3] = 255
    }
  }
  return out
}

const angled = shear(photo, width, height, 9)
writeFileSync(resolve(root, 'composite-angled.png'), encodePng(angled, width, height))
const angledResult = renderIntoPhoto({
  photo: angled,
  photoWidth: width,
  photoHeight: height,
  input: wanted,
  dimensions: { roomWidth: 4200, roomDepth: 3600, roomHeight: 2700, counterHeight: 900, counterDepth: 600 },
  aoSamples: 2,
})
console.log('')
console.log('  Наклонный кадр (9°):', angledResult.log.composited ? 'ВПИСАН — проверка не сработала' : `отклонён — ${angledResult.log.reason}`)
