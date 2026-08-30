/** Проверка чертежей: node scripts/test-drawings.mjs */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildScene } from '../src/render/scene.ts'
import { renderElevation } from '../src/drawings/elevation.ts'
import { renderPlan } from '../src/drawings/plan.ts'
import { buildSchedule, summarize } from '../src/drawings/schedule.ts'
import { hardwareTotals, moduleHardware } from '../src/drawings/hardware.ts'
import { buildWorktopPlan, renderWorktopSheet } from '../src/drawings/worktop.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'drawings-test')
mkdirSync(OUT, { recursive: true })

const input = {
  room: { width: 4.2, height: 2.7, depth: 4.83 },
  counter: { height: 0.9, depth: 0.6 },
  facade: { color: '#4A4C50', pattern: 'paint', roughness: 0.55, handles: 'bar', frame: false, label: 'Эмаль, графит' },
  countertop: { color: '#EAE7E1', pattern: 'marble', roughness: 0.18 },
  wall: '#F2F1ED',
  floor: '#C09A6B',
  accent: '#C09A6B',
  light: { warmth: 0.9, brightness: 0.8, contrast: 0.45 },
  options: { island: true, appliances: true, hood: false, ledLight: true, windows: true, openShelves: false },
  variant: 0,
  seed: 5,
  quality: 'preview',
}

const scene = buildScene(input)
const layout = scene.layout
if (!layout) throw new Error('сцена не отдала раскладку')

const title = 'Кухня — Ивановы'
writeFileSync(resolve(OUT, 'elevation.svg'), renderElevation(layout, title))
writeFileSync(resolve(OUT, 'plan.svg'), renderPlan(layout, title))
const worktop = buildWorktopPlan(layout)
writeFileSync(resolve(OUT, 'worktop.svg'), renderWorktopSheet(worktop, layout, title))

// SVG → PNG для визуальной проверки.
for (const name of ['elevation', 'plan', 'worktop']) {
  try {
    execFileSync('qlmanage', ['-t', '-s', '1400', '-o', OUT, resolve(OUT, `${name}.svg`)], { stdio: 'ignore' })
  } catch {
    /* предпросмотр необязателен */
  }
}

const schedule = buildSchedule(layout)
const stats = summarize(layout)

console.log('')
console.log(`  Помещение: ${layout.room.width}×${layout.room.depth}×${layout.room.height} мм`)
console.log(`  Фронт: ${stats.frontMetres.toFixed(2)} м, модулей: ${stats.modules}, площадь фасадов: ${stats.facadeArea} м²`)
console.log('')
console.log('  ID    Модуль              Ш × В        Глуб.  Дверц.')
console.log('  ' + '─'.repeat(62))
for (const row of schedule) {
  console.log(
    '  ' + row.id.padEnd(6) + row.label.padEnd(20) + row.size.padEnd(13) + row.depth.padEnd(7) + row.doors,
  )
}
console.log('')
console.log('  ВЕДОМОСТЬ КРЕПЕЖА')
for (const line of hardwareTotals(layout, { handles: true, worktopJoints: worktop.joints })) {
  console.log('  ' + line.name.padEnd(34) + String(line.count).padStart(4) + ' ' + line.unit + (line.note ? `  (${line.note})` : ''))
}
console.log('')
console.log('  ФУРНИТУРА ПО МОДУЛЯМ')
for (const module of layout.modules.slice(0, 5)) {
  const h = moduleHardware(module, { handles: true })
  console.log(`  ${module.id.padEnd(5)}${module.label.padEnd(20)}конфирматов ${String(h.confirmats).padStart(2)}, петель ${h.hinges} (${h.hingeAngle}°)${h.slides ? `, направляющих ${h.slides} пар ${h.slideLength} мм` : ''}`)
}
console.log('')
console.log('  Файлы: drawings-test/')
