import { applySchema, db } from './db/connection.ts'
import { createId, nowIso } from './lib/ids.ts'
import { hashPassword } from './lib/password.ts'
import { emptySpec } from '../../shared/src/index.ts'

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

console.log('')
console.log('  Демо-данные созданы.')
console.log(`  Почта:  ${email}`)
console.log('  Пароль: demo12345')
console.log('')
