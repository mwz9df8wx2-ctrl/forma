/**
 * Рендер демонстрационных изображений при сборке проекта.
 *
 * Тот же движок, что и в браузере, только без ограничения по времени —
 * поэтому примеры на главной и в списке проектов открываются мгновенно.
 *
 * Запуск: npm run samples
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './png.mjs'
import { MOCK_CATALOG } from '../src/mock/catalog.ts'
import { DEMO_SEEDS, EXISTING_KITCHEN, HERO_PARAMS } from '../src/mock/demoParams.ts'
import { sceneInputFromParams } from '../src/render/fromCatalog.ts'
import { buildScene } from '../src/render/scene.ts'
import { renderImage } from '../src/render/index.ts'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/samples')
mkdirSync(OUT_DIR, { recursive: true })

/** PNG → JPEG: демо-картинки не должны весить мегабайты на телефоне. */
function writeJpeg(name, rgba, width, height, quality = 82) {
  const pngPath = resolve(OUT_DIR, `${name}.png`)
  const jpgPath = resolve(OUT_DIR, `${name}.jpg`)
  writeFileSync(pngPath, encodePng(rgba, width, height))
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), pngPath, '--out', jpgPath], {
      stdio: 'ignore',
    })
    rmSync(pngPath)
    return jpgPath
  } catch {
    console.warn(`sips недоступен — оставлен PNG для ${name}. Сконвертируйте вручную в ${name}.jpg`)
    return pngPath
  }
}

function render(name, params, variant, width, height, grain = 0.22) {
  const input = sceneInputFromParams(MOCK_CATALOG, params, variant)
  const scene = buildScene(input)
  scene.grain = grain
  const start = Date.now()
  const rgba = renderImage(scene, width, height, { aoSamples: 5 })
  const path = writeJpeg(name, rgba, width, height)
  console.log(`${name}: ${width}×${height}, ${((Date.now() - start) / 1000).toFixed(1)} с → ${path}`)
}

render('hero', HERO_PARAMS, 0, 1000, 667)
render('kitchen-before', EXISTING_KITCHEN, 1, 600, 400)
DEMO_SEEDS.forEach((seed, index) => {
  render(`project-${index + 1}`, seed.params, seed.variant, 600, 400)
})

console.log('Готово.')
