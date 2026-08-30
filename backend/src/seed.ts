import { applySchema, db } from './db/connection.ts'
import { createId, nowIso } from './lib/ids.ts'
import { hashPassword } from './lib/password.ts'
import { defaultProductionProfile, emptySpec } from '../../shared/src/index.ts'

/**
 * Демонстрационные данные для разработки.
 * Помечены как DEMO, чтобы их нельзя было спутать с реальными.
 */

applySchema()

const email = 'demo@forma.ru'
const existing = db().prepare('SELECT id FROM users WHERE email = ?').get(email)
if (existing) {
  console.log(`  Пользователь ${email} уже существует, сид пропущен.`)
  process.exit(0)
}

const now = nowIso()
const companyId = createId('cmp')
const userId = createId('usr')
const projectId = createId('prj')
const revisionId = createId('rev')

db()
  .prepare('INSERT INTO companies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
  .run(companyId, 'DEMO · Мебельная мастерская', now, now)

db()
  .prepare(
    `INSERT INTO users (id, company_id, email, name, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, 'owner', ?)`,
  )
  .run(userId, companyId, email, 'Демо-мастер', hashPassword('demo12345'), now)

const spec = emptySpec('kitchen')
spec.layoutKind = 'corner'
spec.dimensions = {
  roomWidth: 2700,
  roomDepth: 3200,
  roomHeight: 2650,
  counterHeight: 900,
  counterDepth: 600,
  sideRun: 1900,
}
spec.dimensionStatus = {
  roomWidth: 'confirmed',
  roomDepth: 'confirmed',
  roomHeight: 'confirmed',
  counterHeight: 'derived',
  counterDepth: 'derived',
  sideRun: 'confirmed',
}

db()
  .prepare(
    `INSERT INTO projects
       (id, company_id, created_by, title, category, status, client_name,
        current_revision_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'kitchen', 'measurement', ?, ?, ?, ?)`,
  )
  .run(projectId, companyId, userId, 'DEMO · Кухня Ивановы', 'Иванов И.', revisionId, now, now)

db()
  .prepare(
    `INSERT INTO project_revisions
       (id, project_id, revision_number, created_by, source, spec_snapshot, created_at)
     VALUES (?, ?, 1, ?, 'manual', ?, ?)`,
  )
  .run(revisionId, projectId, userId, JSON.stringify(spec), now)

// Демонстрационный каталог: помечен DEMO, чтобы его не приняли за реальный.
const catalogSeed: Array<{ type: string; name: string; attributes: Record<string, unknown> }> = [
  {
    type: 'facade',
    name: 'DEMO · Эмаль жемчужная матовая',
    attributes: {
      brand: 'DEMO', collection: 'Базовая', material: 'enamel', colorName: 'Жемчужный',
      colorHex: '#EAE4D8', finish: 'matte', thicknessMm: 19, handleless: true,
    },
  },
  {
    type: 'facade',
    name: 'DEMO · Эмаль графит матовая',
    attributes: {
      brand: 'DEMO', collection: 'Базовая', material: 'enamel', colorName: 'Графит',
      colorHex: '#4A4C50', finish: 'matte', thicknessMm: 19, handleless: true,
    },
  },
  {
    type: 'facade',
    name: 'DEMO · Шпон дуб натуральный',
    attributes: {
      brand: 'DEMO', collection: 'Дерево', material: 'veneer', colorName: 'Натуральный дуб',
      colorHex: '#C09A6B', finish: 'wood', thicknessMm: 19, handleless: false,
    },
  },
  {
    type: 'countertop',
    name: 'DEMO · Кварц светлый камень',
    attributes: {
      brand: 'DEMO', collection: 'Кварц', material: 'quartz', decor: 'Светлый камень',
      colorHex: '#DED8CC', actualThicknessMm: 20, visualThicknessMm: 38, edgeProfile: 'R3',
    },
  },
  {
    type: 'countertop',
    name: 'DEMO · Камень мрамор белый',
    attributes: {
      brand: 'DEMO', collection: 'Камень', material: 'stone', decor: 'Мрамор',
      colorHex: '#EAE7E1', actualThicknessMm: 20, visualThicknessMm: 50, edgeProfile: 'R3',
    },
  },
  {
    type: 'countertop',
    name: 'DEMO · HPL графит',
    attributes: {
      brand: 'DEMO', collection: 'HPL', material: 'hpl', decor: 'Графит',
      colorHex: '#4B4C4E', actualThicknessMm: 12, visualThicknessMm: 12, edgeProfile: 'R3',
    },
  },
  {
    type: 'carcass',
    name: 'DEMO · ЛДСП белый 16 мм',
    attributes: {
      brand: 'DEMO', decor: 'Белый', material: 'chipboard', thicknessMm: 16,
      backPanelThicknessMm: 4, visibleEdgeMm: 1, hiddenEdgeMm: 0.4,
    },
  },
  {
    type: 'carcass',
    name: 'DEMO · ЛДСП серый 16 мм',
    attributes: {
      brand: 'DEMO', decor: 'Серый', material: 'chipboard', thicknessMm: 16,
      backPanelThicknessMm: 4, visibleEdgeMm: 1, hiddenEdgeMm: 0.4,
    },
  },
]

for (const item of catalogSeed) {
  db()
    .prepare(
      `INSERT INTO catalog_items
         (id, company_id, type, sku, name, attributes, active, demo, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?, 1, 1, ?, ?)`,
    )
    .run(createId('cat'), companyId, item.type, item.name, JSON.stringify(item.attributes), now, now)
}

db()
  .prepare(
    `INSERT INTO production_profiles (id, company_id, name, settings, is_default, created_at)
     VALUES (?, ?, 'Основной', ?, 1, ?)`,
  )
  .run(createId('prf'), companyId, JSON.stringify(defaultProductionProfile()), now)

console.log('')
console.log('  Демо-данные созданы.')
console.log(`  Каталог: ${catalogSeed.length} записей с пометкой DEMO`)
console.log(`  Почта:  ${email}`)
console.log('  Пароль: demo12345')
console.log('')
