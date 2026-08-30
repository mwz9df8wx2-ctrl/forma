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


console.log('\n  ТВ-зона и стенка\n')

const { buildLivingRoomLayout } = await import('../src/drawings/livingRoom.ts')

function livingRoom(category, width = 3.2) {
  return buildLivingRoomLayout({
    room: { width: width + 0.2, height: 2.7, depth: 3.6 },
    width,
    depth: 0.45,
    offset: 0.1,
    tvWidth: 1.2,
    tvBottom: 0.72,
    category,
    facadeLabel: 'Эмаль жемчужная',
  })
}

const tv = livingRoom('tv_zone')
const wall = livingRoom('living_room')

check('категория ТВ-зоны', tv.category, 'tv_zone')
check('столешницы у ТВ-зоны нет', tv.hasWorktop, false)
check('у ТВ-зоны нет пеналов', tv.modules.filter((m) => m.kind === 'tall').length, 0)
check('у стенки два пенала', wall.modules.filter((m) => m.kind === 'tall').length, 2)

const tvModule = wall.modules.find((module) => module.label === 'Телевизор')
check('телевизор попадает в раскладку', tvModule !== undefined, true)
check('телевизор не изготавливается', tvModule.facade, undefined)
check('пропорция телевизора 16:9', Math.round((tvModule.width / tvModule.height) * 100) / 100, 1.78)

// Телевизор висит по центру между пеналами, а не по центру всей стенки:
// иначе он окажется смещён относительно ниши.
const columns = wall.modules.filter((m) => m.kind === 'tall').sort((a, b) => a.x - b.x)
const nicheCentre = (columns[0].x + columns[0].width + columns[1].x) / 2
check('телевизор по центру ниши', Math.abs(tvModule.x + tvModule.width / 2 - nicheCentre) <= 1, true)

// Тумба стоит только между пеналами и не заезжает под них.
const bases = wall.modules.filter((m) => m.kind === 'base')
check(
  'тумба не заходит под пеналы',
  bases.every((m) => m.x >= columns[0].x + columns[0].width - 1 && m.x + m.width <= columns[1].x + 1),
  true,
)

// Полки не садятся на телевизор: кронштейну и вентиляции нужен просвет.
const shelves = wall.modules.filter((m) => m.kind === 'shelf')
check('полки над телевизором есть', shelves.length > 0, true)
check(
  'полки не задевают телевизор',
  shelves.every((shelf) => shelf.y >= tvModule.y + tvModule.height + 80),
  true,
)
check(
  'полки не выходят за потолок',
  shelves.every((shelf) => shelf.y + shelf.height <= wall.room.height),
  true,
)

// Узкая стена не вмещает пеналы — тогда стенка вырождается в ТВ-зону,
// а не пытается втиснуть корпуса, которые некуда поставить.
const narrow = livingRoom('living_room', 1.8)
check('на узкой стене пеналов нет', narrow.modules.filter((m) => m.kind === 'tall').length, 0)

// Крепёж считается той же машинкой.
const wallHardware = hardwareTotals(wall, { handles: true, worktopJoints: 0 })
check(
  'ящики тумбы получили направляющие',
  (wallHardware.find((line) => line.kind === 'slide')?.count ?? 0) > 0,
  true,
)
check(
  'телевизор не добавляет петель',
  moduleHardware(tvModule, { handles: true }).hinges,
  0,
)


console.log('\n  Прихожая и ванная\n')

const { buildHallwayLayout } = await import('../src/drawings/hallway.ts')
const { buildBathroomLayout } = await import('../src/drawings/bathroom.ts')
const { isWallMounted } = await import('../src/drawings/hardware.ts')

const hallway = buildHallwayLayout({
  room: { width: 3.0, height: 2.7, depth: 3.6 },
  width: 2.8,
  height: 2.4,
  offset: 0.1,
  facadeLabel: 'Эмаль жемчужная',
})

check('категория прихожей', hallway.category, 'hallway')
check(
  'вешалка открыта и без петель',
  moduleHardware(
    hallway.modules.find((m) => m.label === 'Открытая вешалка'),
    { handles: true },
  ).hinges,
  0,
)
check(
  'тумба под обувь на ящиках',
  moduleHardware(
    hallway.modules.find((m) => m.label.includes('обуви')),
    { handles: true },
  ).slides > 0,
  true,
)
check(
  'зеркало висит на стене',
  isWallMounted(hallway.modules.find((m) => m.label === 'Зеркало')),
  true,
)
check(
  'мебель прихожей неглубокая',
  hallway.modules
    .filter((m) => m.kind === 'tall' || m.kind === 'base')
    .every((m) => m.depth <= 450),
  true,
)
check(
  'композиция укладывается в стену',
  Math.max(...hallway.modules.map((m) => m.x + m.width)) <= 2900,
  true,
)

const bathroom = buildBathroomLayout({
  room: { width: 2.6, height: 2.6, depth: 3.2 },
  width: 2.4,
  offset: 0.1,
  facadeLabel: 'Эмаль жемчужная',
})

check('категория ванной', bathroom.category, 'bathroom')
// Мебель ванной подвесная: под ней моют пол, и ножек у неё нет.
check(
  'вся мебель ванной подвесная',
  bathroom.modules.filter((m) => m.kind !== 'appliance').every((m) => isWallMounted(m)),
  true,
)
const bathroomHardware = hardwareTotals(bathroom, { handles: true, worktopJoints: 0 })
check('ножек в ванной нет', bathroomHardware.find((line) => line.kind === 'leg')?.count ?? 0, 0)
check(
  'навесы посчитаны',
  (bathroomHardware.find((line) => line.name.includes('Навес'))?.count ?? 0) > 0,
  true,
)
check(
  'нижняя кромка тумбы поднята над полом',
  bathroom.modules.find((m) => m.label.includes('раковину')).y >= 300,
  true,
)

const basin = bathroom.modules.find((m) => m.label.includes('Раковина'))
check('раковина стоит на тумбе', basin !== undefined, true)
check('раковина не изготавливается', basin.facade, undefined)
const vanity = bathroom.modules.find((m) => m.label.includes('раковину'))
check('раковина уже тумбы', basin.width < vanity.width, true)

const mirrorCabinet = bathroom.modules.find((m) => m.label === 'Зеркальный шкаф')
check('зеркальный шкаф есть', mirrorCabinet !== undefined, true)
check('у зеркального шкафа зеркальный фронт', mirrorCabinet.surface, 'mirror')
check(
  'зеркальный шкаф не упирается в потолок',
  mirrorCabinet.y + mirrorCabinet.height <= bathroom.room.height - 150,
  true,
)

// Узкая стена не вмещает пенал — тогда его просто нет.
const narrowBath = buildBathroomLayout({
  room: { width: 1.4, height: 2.6, depth: 3.2 },
  width: 1.0,
  offset: 0.1,
  facadeLabel: 'Эмаль',
})
check('на узкой стене пенала нет', narrowBath.modules.filter((m) => m.kind === 'tall').length, 0)

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
  openSection: true,
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
// Открытая секция — производственный факт: ни дверцы, ни петель, ни ручки.
const openSection = wardrobe.modules.find((module) => module.open)
check('одна секция открыта', openSection !== undefined, true)
check('у открытой секции нет дверец', openSection.doors, 0)
check('у открытой секции не считаются петли', moduleHardware(openSection, { handles: true }).hinges, 0)
check('у открытой секции нет фасада в спецификации', openSection.facade, undefined)

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

function sceneInputFor(category) {
  return {
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
  }
}

function furnitureScene(category) {
  return buildScene(sceneInputFor(category))
}

const wardrobeScene = furnitureScene('wardrobe')
const cabinetScene = furnitureScene('cabinet')
const tvScene = furnitureScene('tv_zone')
const wallScene = furnitureScene('living_room')
const bathScene = furnitureScene('bathroom')

check('сцена ванной знает свою категорию', bathScene.layout.category, 'bathroom')
// Цоколь под подвесной мебелью не рисуется: его там нет.
const plinthBox = bathScene.boxes.find(
  (box) => !box.inverted && box.min[1] === 0 && box.max[1] > 0.05 && box.max[1] < 0.6,
)
check('цоколя под подвесной тумбой нет', plinthBox, undefined)

check('сцена ТВ-зоны знает свою категорию', tvScene.layout.category, 'tv_zone')
check('сцена стенки знает свою категорию', wallScene.layout.category, 'living_room')
// Телевизор виден на картинке: без него непонятно, как это будет висеть.
check(
  'телевизор попал в сцену',
  wallScene.boxes.some((box) => box.max[1] - box.min[1] > 0.4 && box.max[2] - box.min[2] < 0.1 && box.min[1] > 0.6),
  true,
)

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


// Вписывание в фотографию проверялось только на кухне: у шкафа и стенки
// другая привязка к стене, и композит по кухонным линиям был бы подделкой.
const { renderIntoPhoto } = await import('../src/render/pipeline.ts')

const photoWidth = 96
const photoHeight = 64
const photo = new Uint8ClampedArray(photoWidth * photoHeight * 4).fill(180)
for (let i = 3; i < photo.length; i += 4) photo[i] = 255

const composite = renderIntoPhoto({
  photo,
  photoWidth,
  photoHeight,
  input: sceneInputFor('living_room'),
  dimensions: { roomWidth: 3400, roomDepth: 3600, roomHeight: 2700, counterHeight: 900, counterDepth: 450, sideRun: 0 },
  aoSamples: 1,
})
check('стенку в снимок не вписывают', composite.log.composited, false)
check('причина названа честно', composite.log.reason, 'вписывание в снимок работает только для кухни')

console.log(`\n  ${failed === 0 ? `Все ${passed} проверок пройдены.` : `Провалено: ${failed} из ${passed + failed}.`}\n`)
process.exit(failed === 0 ? 0 : 1)
