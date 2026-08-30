/** Быстрый визуальный тест рендера: node scripts/preview-render.mjs */
import { writeFileSync } from 'node:fs'
import { encodePng } from './png.mjs'
import { buildScene } from '../src/render/scene.ts'
import { renderImage } from '../src/render/index.ts'

const input = {
  room: { width: 4.2, height: 2.7, depth: 4.83 },
  counter: { height: 0.9, depth: 0.6 },
  facade: {
    color: process.env.FACADE ?? '#EAE2D5',
    pattern: process.env.PATTERN ?? 'paint',
    roughness: Number(process.env.ROUGH ?? 0.55),
    handles: process.env.HANDLES ?? 'hidden',
    frame: process.env.FRAME === '1',
  },
  countertop: { color: process.env.TOP ?? '#DED8CC', pattern: process.env.TOPPAT ?? 'speck', roughness: 0.2 },
  wall: process.env.WALL ?? '#F2F1ED',
  floor: process.env.FLOOR ?? '#C09A6B',
  accent: process.env.ACCENT ?? '#C09A6B',
  light: {
    warmth: Number(process.env.WARM ?? 0.5),
    brightness: Number(process.env.BRIGHT ?? 0.85),
    contrast: Number(process.env.CONTRAST ?? 0.45),
  },
  options: {
    island: process.env.ISLAND !== '0',
    appliances: true,
    hood: false,
    ledLight: process.env.LED === '1',
    windows: true,
    openShelves: process.env.SHELVES === '1',
  },
  variant: Number(process.argv[3] ?? 0),
  quality: process.env.QUALITY ?? 'preview',
  seed: 12,
}

const width = Number(process.argv[2] ?? 800)
const height = Math.round((width * 2) / 3)

console.time('render')
const scene = buildScene(input)
const rgba = renderImage(scene, width, height, { aoSamples: Number(process.env.AO ?? 3) })
console.timeEnd('render')

writeFileSync(new URL('../preview-test.png', import.meta.url), encodePng(rgba, width, height))
console.log(`Готово: preview-test.png ${width}x${height}, боксов: ${scene.boxes.length}, источников: ${scene.lights.length}`)
