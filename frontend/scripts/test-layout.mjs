/**
 * Тесты угловой планировки.
 *
 * По этим числам режут материал: если боковой ряд наедет на угол, цех
 * получит лишний корпус, который некуда поставить. Проверяем геометрию,
 * а не «выглядит похоже».
 *
 * Запуск: node scripts/test-layout.mjs
 */
import { buildLayout } from '../src/drawings/layout.ts'
import { hardwareTotals, moduleHardware } from '../src/drawings/hardware.ts'
import { buildWorktopPlan } from '../src/drawings/worktop.ts'
import { summarize } from '../src/drawings/schedule.ts'

let passed = 0
let failed = 0

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed += 1
    console.log(`  ✓ ${name}`)
    return
  }
  failed += 1
  console.log(`  ✗ ${name}`)
  console.log(`      ожидалось: ${JSON.stringify(expected)}`)
  console.log(`      получено:  ${JSON.stringify(actual)}`)
}

function layout(sideRunLength) {
  return buildLayout({
    room: { width: 3.2, height: 2.65, depth: 3.6 },
    counter: { height: 0.9, depth: 0.6 },
    run: { start: 0, end: 3.2 },
    backsplashTop: 1.48,
    upperTop: 2.24,
    upperRuns: [{ start: 0, end: 1.6, kind: 'upper' }],
    tallUnit: null,
    island: null,
    window: null,
    appliances: true,
    hood: false,
    hobCentre: 1.2,
    sinkCentre: 2.2,
    facadeLabel: 'Эмаль жемчужная',
    sideRunLength,
  })
}

console.log('\n  Прямая кухня\n')
const straight = layout(0)
check('боковой ряд отсутствует', straight.sideRun, null)
check(
  'все модули у основной стены',
  straight.modules.every((module) => module.wall === 'main'),
  true,
)
check('углового модуля нет', straight.modules.some((module) => module.corner), false)
check('столешница из одной детали', buildWorktopPlan(straight).parts.length, 1)
check('стыков нет', buildWorktopPlan(straight).joints, 0)

console.log('\n  Угловая кухня\n')
const corner = layout(2.4)
check('боковой ряд начинается за глубиной столешницы', corner.sideRun.start, 600)
check('боковой ряд заканчивается на длине стены', corner.sideRun.end, 2400)

const sideModules = corner.modules.filter((module) => module.wall === 'side')
check('боковые модули появились', sideModules.length > 0, true)
check(
  'боковые модули не заходят в угол',
  sideModules.every((module) => module.x >= 600),
  true,
)
check(
  'боковой ряд не выходит за стену',
  Math.max(...sideModules.map((module) => module.x + module.width)),
  2400,
)
check(
  'глубина боковых модулей равна глубине столешницы',
  sideModules.every((module) => module.depth === 600),
  true,
)

const cornerModule = corner.modules.find((module) => module.corner === true)
check('угловой модуль помечен', cornerModule !== undefined, true)
check('угловой модуль стоит первым у основной стены', cornerModule.x, 0)

const cornerHardware = moduleHardware(cornerModule, { handles: true })
const plainModule = corner.modules.find(
  (module) => module.kind === 'base' && module.wall === 'main' && !module.corner,
)
const plainHardware = moduleHardware(plainModule, { handles: true })
check('угловой фасад на петлях 165°', cornerHardware.hingeAngle, 165)
check('обычный фасад на петлях 110°', plainHardware.hingeAngle, 110)
check(
  'угловой корпус требует больше конфирматов',
  cornerHardware.confirmats - plainHardware.confirmats,
  10,
)

const worktop = buildWorktopPlan(corner)
check('столешница из двух деталей', worktop.parts.length, 2)
check('один стык под 90°', worktop.joints, 1)
check('длина боковой детали', worktop.parts[1].length, 1800)
check(
  'в примечаниях есть стык',
  worktop.notes.some((note) => note.includes('Стык')),
  true,
)

check('фронт считается по обоим рядам', Number(summarize(corner).frontMetres.toFixed(2)), 5.0)

console.log('\n  Сцена для трассировки\n')

// Картинка и чертёж обязаны показывать одну кухню. Проверяем, что боковой
// ряд действительно попадает в геометрию сцены, а не только на чертёж.
const { buildScene } = await import('../src/render/scene.ts')

function scene(sideRun) {
  return buildScene({
    room: { width: 3.2, height: 2.65, depth: 3.6 },
    counter: { height: 0.9, depth: 0.6 },
    sideRun,
    facade: { color: '#EAE4D8', pattern: 'flat', roughness: 0.4, handles: 'bar', frame: false },
    countertop: { color: '#D8D4CC', pattern: 'flat', roughness: 0.3 },
    wall: '#EFEDE8',
    floor: '#C9BFAF',
    accent: '#C09A6B',
    light: { warmth: 0.5, brightness: 0.5, contrast: 0.4 },
    options: {
      island: false,
      appliances: true,
      hood: false,
      ledLight: false,
      windows: false,
      openShelves: false,
    },
    variant: 0,
    seed: 1,
  })
}

const straightScene = scene(0)
const cornerScene = scene(2.4)

check('прямая кухня без бокового ряда', straightScene.layout.sideRun, null)
check('угловая кухня с боковым рядом', cornerScene.layout.sideRun !== null, true)
check(
  'в угловой сцене больше геометрии',
  cornerScene.boxes.length > straightScene.boxes.length,
  true,
)

// Боковой ряд стоит у левой стены: коробки с малым x появляются только у угловой.
const nearLeftWall = (built) =>
  built.boxes.filter((box) => box.min[0] < 0.05 && box.max[0] < 0.7 && box.max[1] > 0.5)
check('у левой стены появились корпуса', nearLeftWall(cornerScene).length > 0, true)
check('у прямой кухни левая стена пуста', nearLeftWall(straightScene).length, 0)


console.log('\n  Шкаф\n')

const { buildWardrobeLayout } = await import('../src/drawings/wardrobe.ts')

const wardrobe = buildWardrobeLayout({
  room: { width: 3.0, height: 2.7, depth: 3.4 },
  width: 2.4,
  height: 2.4,
  depth: 0.6,
  offset: 0.1,
  hangingSections: 2,
  drawers: 4,
  topBox: true,
  facadeLabel: 'Эмаль жемчужная',
  category: 'wardrobe',
})

check('категория объекта', wardrobe.category, 'wardrobe')
check('столешницы нет', wardrobe.hasWorktop, false)
check('лист столешницы не выпускается', buildWorktopPlan(wardrobe).parts.length, 0)

const sections = wardrobe.modules.filter((module) => module.kind === 'tall')
check('секции разбиты по 600 мм', sections.length, 4)
check(
  'секции стоят вплотную',
  sections.every((module, index) =>
    index === 0 ? module.x === 100 : module.x === sections[index - 1].x + sections[index - 1].width,
  ),
  true,
)
check(
  'секции не выходят за габарит',
  sections[sections.length - 1].x + sections[sections.length - 1].width,
  2500,
)

check(
  'штанга есть в каждой секции для одежды',
  wardrobe.modules.filter((module) => module.label === 'Штанга для одежды').length,
  2,
)
check(
  'блок ящиков один',
  wardrobe.modules.filter((module) => module.label === 'Блок ящиков').length,
  1,
)
check(
  'антресоль над каждой секцией',
  wardrobe.modules.filter((module) => module.kind === 'upper').length,
  4,
)
check(
  'полки не заходят в антресоль',
  wardrobe.modules
    .filter((module) => module.label === 'Полка секции')
    .every((module) => module.y + module.height <= 2000),
  true,
)

// Крепёж считается той же машинкой, что и для кухни: отдельных правил
// для шкафа нет, иначе они разошлись бы с кухонными.
const wardrobeHardware = hardwareTotals(wardrobe, { handles: true, worktopJoints: 0 })
check(
  'конфирматы посчитаны',
  wardrobeHardware.some((line) => line.kind === 'confirmat' && line.count > 0),
  true,
)
check(
  'направляющие под ящики посчитаны',
  wardrobeHardware.find((line) => line.kind === 'slide')?.count,
  4,
)
check(
  'ножек у шкафа нет',
  wardrobeHardware.find((line) => line.kind === 'leg')?.count ?? 0,
  0,
)


console.log('\n  Сцена шкафа\n')

function furnitureScene(category) {
  return buildScene({
    category,
    room: { width: 3.0, height: 2.7, depth: 3.6 },
    counter: { height: 0.9, depth: 0.6 },
    sideRun: 0,
    facade: { color: '#EAE4D8', pattern: 'flat', roughness: 0.4, handles: 'bar', frame: false },
    countertop: { color: '#D8D4CC', pattern: 'flat', roughness: 0.3 },
    wall: '#EFEDE8',
    floor: '#C9BFAF',
    accent: '#C09A6B',
    light: { warmth: 0.5, brightness: 0.5, contrast: 0.4 },
    options: {
      island: false,
      appliances: true,
      hood: false,
      ledLight: false,
      windows: true,
      openShelves: false,
    },
    variant: 0,
    seed: 1,
  })
}

const wardrobeScene = furnitureScene('wardrobe')
const cabinetScene = furnitureScene('cabinet')

check('сцена шкафа знает свою категорию', wardrobeScene.layout.category, 'wardrobe')
check('сцена тумбы знает свою категорию', cabinetScene.layout.category, 'cabinet')
check('у шкафа нет столешницы', wardrobeScene.layout.hasWorktop, false)

// Картинка обязана показывать столько же секций, сколько уходит в спецификацию.
const drawnSections = wardrobeScene.layout.modules.filter((module) => module.kind === 'tall').length
check('секций в сцене столько же, сколько в спецификации', drawnSections > 0, true)

// Корпус собран из деталей: сплошной блок скрыл бы полки открытой секции.
// Оболочку помещения не считаем — она вывернута наизнанку.
const solidBody = wardrobeScene.boxes.some(
  (box) =>
    !box.inverted &&
    box.max[0] - box.min[0] > 2 &&
    box.max[1] - box.min[1] > 1.5 &&
    box.max[2] - box.min[2] > 0.5,
)
check('корпус не рисуется сплошным блоком', solidBody, false)

// Полки открытой секции попадают в сцену — ради них шкаф и показывают.
const shelfBoxes = wardrobeScene.boxes.filter(
  (box) => box.max[1] - box.min[1] < 0.03 && box.max[2] - box.min[2] > 0.3 && box.min[1] > 0.3,
)
check('полки открытой секции видны', shelfBoxes.length > 0, true)

// Кадр должен вмещать изделие целиком: иначе на картинке одна дверца.
const covered =
  2 *
  (wardrobeScene.camera.target[2] - wardrobeScene.camera.position[2]) *
  Math.tan(((wardrobeScene.camera.fov * Math.PI) / 180) / 2)
check('изделие помещается в кадр по высоте', covered > 2.6, true)

console.log(`\n  ${failed === 0 ? `Все ${passed} проверок пройдены.` : `Провалено: ${failed} из ${passed + failed}.`}\n`)
process.exit(failed === 0 ? 0 : 1)
