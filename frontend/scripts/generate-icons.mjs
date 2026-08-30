/**
 * Генерация иконок приложения без внешних зависимостей.
 * Рисует знак «ФОРМА» — L-образную планировку кухни — и кодирует PNG вручную.
 *
 * Запуск: npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')

const BACKGROUND = [26, 25, 23, 255]
const FOREGROUND = [255, 255, 255, 255]

/** Знак задан в сетке 24×24 — те же координаты, что и в SVG-логотипе. */
const SHAPES = [
  { x: 4.5, y: 4.5, w: 5, h: 15 },
  { x: 4.5, y: 14.5, w: 15, h: 5 },
  { x: 13, y: 4.5, w: 6.5, h: 1.6 },
  { x: 17.9, y: 4.5, w: 1.6, h: 6.5 },
]

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function renderPng(size, padding) {
  const scale = size / 24
  const inner = size - padding * 2
  const innerScale = inner / 24
  const raster = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const gx = (x - padding) / innerScale
      const gy = (y - padding) / innerScale
      const inside = SHAPES.some(
        (shape) => gx >= shape.x && gx <= shape.x + shape.w && gy >= shape.y && gy <= shape.y + shape.h,
      )
      const color = inside ? FOREGROUND : BACKGROUND
      const offset = (y * size + x) * 4
      raster[offset] = color[0]
      raster[offset + 1] = color[1]
      raster[offset + 2] = color[2]
      raster[offset + 3] = color[3]
    }
  }

  // Каждая строка PNG предваряется байтом фильтра.
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    rows[y * (size * 4 + 1)] = 0
    raster.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // глубина канала
  header[9] = 6 // RGBA
  void scale

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, padding: 34 },
  { file: 'icon-512.png', size: 512, padding: 92 },
  { file: 'icon-maskable-512.png', size: 512, padding: 132 },
]

for (const target of targets) {
  writeFileSync(resolve(OUT_DIR, target.file), renderPng(target.size, target.padding))
  console.log(`Готово: ${target.file} (${target.size}×${target.size})`)
}
