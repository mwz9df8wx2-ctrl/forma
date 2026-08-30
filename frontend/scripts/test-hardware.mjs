/**
 * Тесты детерминированных расчётов.
 * Эти числа уходят в цех, поэтому они проверяются, а не «выглядят правдоподобно».
 *
 * Запуск: node scripts/test-hardware.mjs
 */
import { facadeSize, hardwareTotals, moduleHardware, slideLengthForDepth } from '../src/drawings/hardware.ts'
import { splitRun } from '../src/drawings/layout.ts'

let passed = 0
let failed = 0

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed += 1
  } else {
    failed += 1
    console.log(`  ✗ ${name}`)
    console.log(`      ожидалось: ${JSON.stringify(expected)}`)
    console.log(`      получено:  ${JSON.stringify(actual)}`)
    return
  }
  console.log(`  ✓ ${name}`)
}

const base = (over = {}) => ({
  id: 'Н1',
  kind: 'base',
  label: 'Нижний модуль',
  x: 0,
  width: 600,
  y: 95,
  height: 767,
  depth: 560,
  doors: 1,
  ...over,
})

console.log('')
console.log('  Разбивка фронта на модули')
check('3400 мм → шесть модулей', splitRun(3400).length, 6)
check('3400 мм сходится в сумму', splitRun(3400).reduce((a, b) => a + b, 0), 3400)
check('600 мм → один модуль', splitRun(600), [600])
check('250 мм → доборный элемент', splitRun(250), [250])

console.log('')
console.log('  Фасады и зазоры')
check('проём 600, один фасад → 598 × 765', facadeSize(base()), { width: 598, height: 765, count: 1 })
check('проём 900, два фасада → 448', facadeSize(base({ width: 900, doors: 2 })).width, 448)

console.log('')
console.log('  Петли по высоте фасада')
check('фасад 765 → 2 петли', moduleHardware(base(), { handles: true }).hinges, 2)
check('фасад 1400 → 3 петли', moduleHardware(base({ height: 1400 }), { handles: true }).hinges, 3)
check(
  'пенал 2180 → 4 петли на фасад, два фасада → 8',
  moduleHardware({ ...base(), kind: 'tall', height: 2180, doors: 2 }, { handles: true }).hinges,
  8,
)
check(
  'угловой модуль → петли 165°',
  moduleHardware(base({ label: 'Угловой модуль' }), { handles: true }).hingeAngle,
  165,
)

console.log('')
console.log('  Корпус и крепёж')
check('базовый корпус с полкой → 12 конфирматов', moduleHardware(base(), { handles: true }).confirmats, 12)
check(
  'угловой корпус → 22 конфирмата',
  moduleHardware(base({ label: 'Угловой модуль' }), { handles: true }).confirmats,
  22,
)
check(
  'пенал 2180 → 30 конфирматов',
  moduleHardware({ ...base(), kind: 'tall', height: 2180, doors: 2 }, { handles: true }).confirmats,
  30,
)
check('глубина 560 → направляющая 500', slideLengthForDepth(560), 500)
check('глубина 520 → направляющая 450', slideLengthForDepth(520), 450)
check(
  'модуль с ящиками → направляющие, без петель',
  (() => {
    const h = moduleHardware(base({ label: 'Тумба с 3 ящиками', doors: 3 }), { handles: true })
    return { slides: h.slides, hinges: h.hinges, length: h.slideLength }
  })(),
  { slides: 3, hinges: 0, length: 500 },
)
check(
  'фасады без ручек → ручек ноль',
  moduleHardware(base(), { handles: false }).handles,
  0,
)

console.log('')
console.log('  Ведомость по проекту')
const layout = {
  room: { width: 2700, depth: 3200, height: 2700 },
  counter: { height: 900, depth: 600, thickness: 38 },
  run: { start: 0, end: 2700 },
  backsplash: { top: 1480 },
  window: null,
  modules: [
    base({ id: 'Н1' }),
    base({ id: 'Н2' }),
    { ...base({ id: 'В1' }), kind: 'upper', height: 720, depth: 320, y: 1480 },
    { ...base({ id: 'В2' }), kind: 'upper', height: 720, depth: 320, y: 1480 },
  ],
}
const totals = hardwareTotals(layout, { handles: true, worktopJoints: 1 })
const find = (name) => totals.find((line) => line.name.startsWith(name))?.count ?? 0
check('навесов на два верхних шкафа', find('Навес'), 2)
check('ножек: 2 на модуль + 2 концевые', find('Ножка'), 6)
check('стяжек столешницы на один стык', find('Стяжка'), 3)
check('петель 110° всего', find('Петля 110'), 8)

console.log('')
console.log(failed === 0 ? `  Все ${passed} проверок пройдены.` : `  Провалено ${failed} из ${passed + failed}.`)
process.exit(failed === 0 ? 0 : 1)
