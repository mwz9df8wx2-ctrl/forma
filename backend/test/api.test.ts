import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Server } from 'node:http'

/**
 * Интеграционные тесты API.
 *
 * Проверяется то, что нельзя проверить глазами: изоляция компаний,
 * неизменяемость согласованной ревизии и приватность файлов.
 */

const TEST_DIR = resolve(import.meta.dirname, '../data/test-run')
process.env.DATABASE_FILE = `${TEST_DIR}/test.db`
process.env.STORAGE_DIR = `${TEST_DIR}/files`
process.env.SESSION_SECRET = 'test-secret'

const { createApp } = await import('../src/server.ts')
const { applySchema } = await import('../src/db/connection.ts')

let server: Server
let base = ''

async function api(
  path: string,
  options: { method?: string; token?: string; body?: unknown; raw?: Buffer; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...options.headers }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let body: string | Buffer | undefined
  if (options.raw) {
    body = options.raw
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, body })
  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  // Ответ разбирается динамически: в тестах интересна форма, а не типы.
  return { status: response.status, body: json as any, raw: text }
}

const completeSpec = {
  version: 1 as const,
  category: 'kitchen' as const,
  layoutKind: 'corner' as const,
  dimensions: {
    roomWidth: 2700,
    roomDepth: 3200,
    roomHeight: 2650,
    counterHeight: 900,
    counterDepth: 600,
    sideRun: 1900,
  },
  dimensionStatus: { roomWidth: 'confirmed' as const, sideRun: 'confirmed' as const },
  materials: {
    materialId: 'enamel',
    colorId: 'pearl',
    textureId: 'matte',
    paletteId: 'warm-minimal',
    styleId: 'modern-minimal',
    countertopMaterialId: 'quartz',
    countertopColorId: 'top-light-stone',
    lightingId: 'warm',
  },
  options: { handleless: true },
  appliances: [],
  utilities: [],
  notes: 'Верхние шкафы до потолка',
}

before(async () => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  applySchema()
  server = createApp()
  await new Promise<void>((done) => server.listen(0, done))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  base = `http://127.0.0.1:${port}`
})

after(() => {
  server.close()
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('Аутентификация', () => {
  it('регистрирует компанию и выдаёт токен', async () => {
    const response = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Мебель Плюс', name: 'Пётр', email: 'a@test.ru', password: 'parol12345' },
    })
    assert.equal(response.status, 201)
    assert.ok(response.body.token)
    assert.equal(response.body.user.role, 'owner')
  })

  it('не пускает с неверным паролем', async () => {
    const response = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'wrong-password' },
    })
    assert.equal(response.status, 401)
  })

  it('не отдаёт проекты без токена', async () => {
    const response = await api('/api/v1/projects')
    assert.equal(response.status, 401)
  })
})

describe('Проект и ревизии', () => {
  let token = ''
  let projectId = ''
  let revisionId = ''

  before(async () => {
    const auth = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
  })

  it('создаёт проект с первой ревизией', async () => {
    const response = await api('/api/v1/projects', {
      method: 'POST',
      token,
      body: { title: 'Кухня — Ивановы', clientName: 'Иванов' },
    })
    assert.equal(response.status, 201)
    projectId = response.body.project.id
    revisionId = response.body.revision.id
    assert.equal(response.body.revision.revisionNumber, 1)
    assert.equal(response.body.revision.locked, false)
    assert.equal(response.body.revision.readiness.ready, false)
  })

  it('правит черновую ревизию на месте, без создания новой', async () => {
    const response = await api(`/api/v1/projects/${projectId}/spec`, {
      method: 'POST',
      token,
      body: { spec: completeSpec, source: 'manual' },
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.createdNewRevision, false)
    assert.equal(response.body.revision.id, revisionId)
    assert.equal(response.body.revision.readiness.ready, true)
  })

  it('отклоняет спецификацию с недопустимым размером', async () => {
    const broken = { ...completeSpec, dimensions: { ...completeSpec.dimensions, roomWidth: -5 } }
    const response = await api(`/api/v1/projects/${projectId}/spec`, {
      method: 'POST',
      token,
      body: { spec: broken },
    })
    assert.equal(response.status, 400)
  })

  it('согласовывает ревизию и блокирует её', async () => {
    const response = await api(`/api/v1/projects/${projectId}/revisions/${revisionId}/approve`, {
      method: 'POST',
      token,
      body: { clientName: 'Иванов' },
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.revision.locked, true)
    assert.equal(response.body.revision.approvalStatus, 'approved')
  })

  it('не согласовывает дважды', async () => {
    const response = await api(`/api/v1/projects/${projectId}/revisions/${revisionId}/approve`, {
      method: 'POST',
      token,
      body: {},
    })
    assert.equal(response.status, 409)
  })

  it('после согласования правка спецификации создаёт новую ревизию', async () => {
    const changed = {
      ...completeSpec,
      materials: { ...completeSpec.materials, colorId: 'graphite' },
    }
    const response = await api(`/api/v1/projects/${projectId}/spec`, {
      method: 'POST',
      token,
      body: { spec: changed },
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.createdNewRevision, true)
    assert.equal(response.body.revision.revisionNumber, 2)
    assert.equal(response.body.revision.parentRevisionId, revisionId)
  })

  it('согласованная ревизия осталась нетронутой', async () => {
    const response = await api(`/api/v1/projects/${projectId}/revisions`, { token })
    const approved = response.body.revisions.find((r: { id: string }) => r.id === revisionId)
    assert.equal(approved.locked, true)
    assert.equal(approved.spec.materials.colorId, 'pearl')
  })
})

describe('Изоляция компаний', () => {
  let tokenA = ''
  let tokenB = ''
  let projectA = ''
  let fileA = ''

  before(async () => {
    const a = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'parol12345' },
    })
    tokenA = a.body.token

    const b = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Другая фирма', name: 'Сергей', email: 'b@test.ru', password: 'parol12345' },
    })
    tokenB = b.body.token

    const project = await api('/api/v1/projects', {
      method: 'POST',
      token: tokenA,
      body: { title: 'Секретный проект' },
    })
    projectA = project.body.project.id

    // Минимальный корректный PNG.
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100' +
        '05fe02fea7000000004945' + '4e44ae426082',
      'hex',
    )
    const upload = await api(`/api/v1/projects/${projectA}/files`, {
      method: 'POST',
      token: tokenA,
      raw: png,
      headers: { 'X-File-Kind': 'room_photo' },
    })
    fileA = upload.body.file.id
  })

  it('чужой проект не виден в списке', async () => {
    const response = await api('/api/v1/projects', { token: tokenB })
    const ids = response.body.projects.map((p: { id: string }) => p.id)
    assert.ok(!ids.includes(projectA))
  })

  it('чужой проект недоступен по прямой ссылке', async () => {
    const response = await api(`/api/v1/projects/${projectA}`, { token: tokenB })
    assert.equal(response.status, 404)
  })

  it('чужой проект нельзя изменить', async () => {
    const response = await api(`/api/v1/projects/${projectA}`, {
      method: 'PATCH',
      token: tokenB,
      body: { title: 'Взлом' },
    })
    assert.equal(response.status, 404)
  })

  it('чужой файл не отдаётся', async () => {
    const response = await api(`/api/v1/files/${fileA}`, { token: tokenB })
    assert.equal(response.status, 404)
  })

  it('свой файл отдаётся владельцу', async () => {
    const response = await fetch(`${base}/api/v1/files/${fileA}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
  })

  it('файл без токена не отдаётся', async () => {
    const response = await api(`/api/v1/files/${fileA}`)
    assert.equal(response.status, 401)
  })
})

describe('Загрузка файлов', () => {
  let token = ''
  let projectId = ''

  before(async () => {
    const auth = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
    const project = await api('/api/v1/projects', {
      method: 'POST',
      token,
      body: { title: 'Проект для файлов' },
    })
    projectId = project.body.project.id
  })

  it('отклоняет файл, который не является изображением', async () => {
    const response = await api(`/api/v1/projects/${projectId}/files`, {
      method: 'POST',
      token,
      raw: Buffer.from('это просто текст, а не картинка'),
      headers: { 'X-File-Kind': 'room_photo' },
    })
    assert.equal(response.status, 400)
  })

  it('отклоняет неизвестный тип файла', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex')
    const response = await api(`/api/v1/projects/${projectId}/files`, {
      method: 'POST',
      token,
      raw: png,
      headers: { 'X-File-Kind': 'unknown-kind' },
    })
    assert.equal(response.status, 400)
  })
})

describe('Ключи провайдеров', () => {
  let token = ''
  before(async () => {
    const auth = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
  })

  it('возможности отдаются без раскрытия ключей', async () => {
    const response = await api('/api/v1/ai/capabilities', { token })
    assert.equal(response.status, 200)
    const text = JSON.stringify(response.body)
    assert.ok(!text.includes('sk-'), 'ключ не должен попадать в ответ')
    assert.equal(typeof response.body.generationEnabled, 'boolean')
  })
})

describe('Каталог компании', () => {
  let tokenA = ''
  let tokenB = ''
  let itemId = ''

  before(async () => {
    const a = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'parol12345' },
    })
    tokenA = a.body.token
    const b = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'b@test.ru', password: 'parol12345' },
    })
    tokenB = b.body.token
  })

  it('создаёт фасад с проверкой атрибутов', async () => {
    const response = await api('/api/v1/catalog', {
      method: 'POST',
      token: tokenA,
      body: {
        type: 'facade',
        name: 'Эмаль жемчужная',
        salePrice: 4200,
        attributes: {
          brand: 'Свой цех',
          collection: 'Базовая',
          material: 'enamel',
          colorName: 'Жемчужный',
          colorHex: '#EAE4D8',
          finish: 'matte',
          thicknessMm: 19,
          handleless: true,
        },
      },
    })
    assert.equal(response.status, 201)
    itemId = response.body.item.id
    assert.equal(response.body.item.attributes.colorName, 'Жемчужный')
    assert.equal(response.body.item.demo, false)
  })

  it('отклоняет неверный цвет', async () => {
    const response = await api('/api/v1/catalog', {
      method: 'POST',
      token: tokenA,
      body: {
        type: 'facade',
        name: 'Плохой цвет',
        attributes: {
          material: 'enamel',
          colorName: 'Что-то',
          colorHex: 'зелёный',
          finish: 'matte',
        },
      },
    })
    assert.equal(response.status, 400)
  })

  it('отклоняет атрибуты чужого типа', async () => {
    const response = await api('/api/v1/catalog', {
      method: 'POST',
      token: tokenA,
      body: {
        type: 'countertop',
        name: 'Столешница с полями фасада',
        attributes: { material: 'enamel', colorName: 'Жемчужный', colorHex: '#EAE4D8', finish: 'matte' },
      },
    })
    assert.equal(response.status, 400)
  })

  it('чужой каталог не виден', async () => {
    const response = await api('/api/v1/catalog?type=facade', { token: tokenB })
    const ids = response.body.items.map((item: { id: string }) => item.id)
    assert.ok(!ids.includes(itemId))
  })

  it('чужую запись нельзя изменить', async () => {
    const response = await api(`/api/v1/catalog/${itemId}`, {
      method: 'PATCH',
      token: tokenB,
      body: { name: 'Взлом' },
    })
    assert.equal(response.status, 404)
  })

  it('запись выключается, а не удаляется', async () => {
    const disable = await api(`/api/v1/catalog/${itemId}`, { method: 'DELETE', token: tokenA })
    assert.equal(disable.status, 200)

    const active = await api('/api/v1/catalog?type=facade', { token: tokenA })
    assert.ok(!active.body.items.some((item: { id: string }) => item.id === itemId))

    const all = await api('/api/v1/catalog?type=facade&inactive=true', { token: tokenA })
    const found = all.body.items.find((item: { id: string }) => item.id === itemId)
    assert.ok(found, 'запись должна остаться в базе')
    assert.equal(found.active, false)
  })
})

describe('Производственный профиль', () => {
  let token = ''
  before(async () => {
    const auth = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'a@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
  })

  it('отдаёт значения по умолчанию, пока профиль не сохранён', async () => {
    const response = await api('/api/v1/production-profile', { token })
    assert.equal(response.status, 200)
    assert.equal(response.body.profile.carcassThicknessMm, 16)
    assert.equal(response.body.profile.facadeGapMm, 2)
    assert.equal(response.body.isDefault, true)
  })

  it('сохраняет и возвращает изменённый профиль', async () => {
    const saved = await api('/api/v1/production-profile', {
      method: 'PATCH',
      token,
      body: {
        carcassThicknessMm: 18,
        facadeThicknessMm: 19,
        backPanelThicknessMm: 4,
        facadeGapMm: 3,
        plinthHeightMm: 120,
        baseDepthMm: 560,
        upperDepthMm: 320,
        worktopDepthMm: 600,
        worktopHeightMm: 910,
        visibleEdgeMm: 2,
        hiddenEdgeMm: 0.4,
        defaultHardwareBrand: 'Blum',
      },
    })
    assert.equal(saved.status, 200)

    const response = await api('/api/v1/production-profile', { token })
    assert.equal(response.body.profile.carcassThicknessMm, 18)
    assert.equal(response.body.profile.worktopHeightMm, 910)
    assert.equal(response.body.isDefault, false)
  })

  it('отклоняет недопустимую толщину', async () => {
    const response = await api('/api/v1/production-profile', {
      method: 'PATCH',
      token,
      body: { carcassThicknessMm: 500 },
    })
    assert.equal(response.status, 400)
  })
})

// --- M3: кредиты, лимиты и очередь заданий ---------------------------------

const { env: serverEnv } = await import('../src/env.ts')
const { setImageProvider, MockImageProvider } = await import('../src/providers/images.ts')
const { db: testDb } = await import('../src/db/connection.ts')

/** Ожидание завершения задания опросом — так же, как это делает браузер. */
async function waitForJob(token: string, jobId: string, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  let last: any = null
  while (Date.now() < deadline) {
    const response = await api(`/api/v1/generations/${jobId}`, { token })
    last = response.body?.job
    if (last && (last.status === 'completed' || last.status === 'failed')) return last
    await new Promise((done) => setTimeout(done, 25))
  }
  return last
}

async function makeReadyProject(token: string, title: string) {
  const created = await api('/api/v1/projects', { method: 'POST', token, body: { title } })
  const projectId = created.body.project.id
  await api(`/api/v1/projects/${projectId}/spec`, {
    method: 'POST',
    token,
    body: { spec: completeSpec, source: 'manual' },
  })
  return projectId as string
}

describe('Кредиты и очередь генерации', () => {
  let token = ''
  let projectId = ''

  before(async () => {
    const auth = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Кредиты', name: 'Кассир', email: 'credits@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
    projectId = await makeReadyProject(token, 'Кухня — кредиты')
    setImageProvider(new MockImageProvider())
  })

  after(() => setImageProvider(null))

  it('новая компания получает пробные кредиты', async () => {
    const response = await api('/api/v1/billing/wallet', { token })
    assert.equal(response.status, 200)
    assert.equal(response.body.wallet.available, 10)
    assert.equal(response.body.wallet.reserved, 0)
    assert.equal(response.body.costs.preview, 1)
  })

  it('задание проходит стадии и сохраняет варианты', async () => {
    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 2, seed: 42 },
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.cost, 2)

    const job = await waitForJob(token, response.body.job.id)
    assert.equal(job.status, 'completed')
    assert.equal(job.options.length, 2)
    assert.equal(job.creditsReserved, 2)

    // Варианты должны быть настоящими файлами, а не записями в базе.
    const file = await api(job.options[0].url, { token })
    assert.equal(file.status, 200)
  })

  it('списывает кредиты один раз и закрывает резерв', async () => {
    const wallet = await api('/api/v1/billing/wallet', { token })
    assert.equal(wallet.body.wallet.available, 8)
    assert.equal(wallet.body.wallet.reserved, 0)

    const ledger = await api('/api/v1/billing/transactions', { token })
    const types = ledger.body.transactions.map((item: any) => item.type)
    assert.deepEqual(types, ['charge', 'grant'])

    const charge = ledger.body.transactions[0]
    assert.equal(charge.creditDelta, -2)
    assert.equal(charge.balanceBefore, 10)
    assert.equal(charge.balanceAfter, 8)
  })

  it('сумма журнала совпадает с балансом', async () => {
    const wallet = await api('/api/v1/billing/wallet', { token })
    const ledger = await api('/api/v1/billing/transactions', { token })
    const sum = ledger.body.transactions.reduce((total: number, item: any) => total + item.creditDelta, 0)
    assert.equal(sum, wallet.body.wallet.balance)
  })

  it('повтор с тем же ключом идемпотентности не создаёт второе задание', async () => {
    const headers = { 'Idempotency-Key': 'one-button-double-click' }
    const first = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      headers,
      body: { quality: 'preview', variants: 1 },
    })
    const second = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      headers,
      body: { quality: 'preview', variants: 1 },
    })

    assert.equal(first.body.job.id, second.body.job.id)
    assert.equal(second.body.reused, true)
    await waitForJob(token, first.body.job.id)

    const wallet = await api('/api/v1/billing/wallet', { token })
    // Списан ровно один кредит, а не два.
    assert.equal(wallet.body.wallet.available, 7)
  })

  it('не запускает генерацию без замеров', async () => {
    const empty = await api('/api/v1/projects', {
      method: 'POST',
      token,
      body: { title: 'Кухня без размеров' },
    })
    const before = await api('/api/v1/billing/wallet', { token })
    const response = await api(`/api/v1/projects/${empty.body.project.id}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 1 },
    })
    assert.equal(response.status, 400)
    const after = await api('/api/v1/billing/wallet', { token })
    assert.equal(after.body.wallet.available, before.body.wallet.available)
  })

  it('чужое задание не отдаётся', async () => {
    const other = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Чужие', name: 'Гость', email: 'alien-jobs@test.ru', password: 'parol12345' },
    })
    const jobs = await api(`/api/v1/projects/${projectId}/generations`, { token })
    const response = await api(`/api/v1/generations/${jobs.body.jobs[0].id}`, { token: other.body.token })
    assert.equal(response.status, 404)
  })

  it('ограничивает число вариантов за один запуск', async () => {
    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 8 },
    })
    assert.equal(response.status, 400)
  })
})

describe('Отказы и возвраты', () => {
  let token = ''
  let projectId = ''

  before(async () => {
    const auth = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Возвраты', name: 'Мастер', email: 'refund@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
    projectId = await makeReadyProject(token, 'Кухня — возвраты')
  })

  after(() => {
    setImageProvider(null)
    serverEnv.aiEnabled = true
  })

  it('возвращает кредиты при сбое провайдера', async () => {
    setImageProvider({
      name: 'broken',
      model: 'broken-1',
      estimateKopecks: () => 0,
      generate: async () => {
        throw new Error('Провайдер недоступен')
      },
      isTransient: () => false,
    })

    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'final', variants: 2 },
    })
    assert.equal(response.status, 201)

    const job = await waitForJob(token, response.body.job.id)
    assert.equal(job.status, 'failed')
    assert.equal(job.attempts, 1) // постоянную ошибку не повторяем

    const wallet = await api('/api/v1/billing/wallet', { token })
    assert.equal(wallet.body.wallet.available, 10)
    assert.equal(wallet.body.wallet.reserved, 0)

    const ledger = await api('/api/v1/billing/transactions', { token })
    assert.equal(ledger.body.transactions[0].type, 'refund')
    assert.equal(ledger.body.transactions[0].creditDelta, 4)
  })

  it('повторяет временную ошибку, но платит один раз', async () => {
    let calls = 0
    const mock = new MockImageProvider()
    setImageProvider({
      name: 'flaky',
      model: 'flaky-1',
      estimateKopecks: () => 0,
      generate: async (request) => {
        calls += 1
        if (calls === 1) throw new Error('таймаут сети')
        return mock.generate(request)
      },
      isTransient: () => true,
    })

    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 1 },
    })
    const job = await waitForJob(token, response.body.job.id)
    assert.equal(job.status, 'completed')
    assert.equal(job.attempts, 2)
    assert.equal(calls, 2)

    const wallet = await api('/api/v1/billing/wallet', { token })
    assert.equal(wallet.body.wallet.available, 9)
  })

  it('отказывает при нулевом балансе и не трогает остальное приложение', async () => {
    setImageProvider(new MockImageProvider())
    testDb()
      .prepare('UPDATE credit_wallets SET balance = 0 WHERE company_id = (SELECT company_id FROM projects WHERE id = ?)')
      .run(projectId)

    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 1 },
    })
    assert.equal(response.status, 402)
    assert.match(response.body.message, /кредиты закончились/i)

    // Проекты продолжают работать — это обещание из интерфейса.
    const projects = await api('/api/v1/projects', { token })
    assert.equal(projects.status, 200)
  })

  it('общий выключатель останавливает новые запуски', async () => {
    testDb()
      .prepare('UPDATE credit_wallets SET balance = 10 WHERE company_id = (SELECT company_id FROM projects WHERE id = ?)')
      .run(projectId)
    serverEnv.aiEnabled = false

    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 1 },
    })
    assert.equal(response.status, 503)

    const wallet = await api('/api/v1/billing/wallet', { token })
    assert.equal(wallet.body.wallet.available, 10)
    serverEnv.aiEnabled = true
  })

  it('останавливает запуск при исчерпанном бюджете', async () => {
    setImageProvider({
      name: 'dear',
      model: 'dear-1',
      // Оценка выше месячного лимита пользователя.
      estimateKopecks: () => 400_000,
      generate: async () => ({ images: [], model: 'dear-1', actualCostKopecks: 0 }),
      isTransient: () => false,
    })

    const response = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token,
      body: { quality: 'preview', variants: 1 },
    })
    assert.equal(response.status, 429)

    const wallet = await api('/api/v1/billing/wallet', { token })
    assert.equal(wallet.body.wallet.available, 10)
    setImageProvider(new MockImageProvider())
  })
})

// --- M4: замеры, разбор текста и подтверждение ------------------------------

describe('Замеры и разбор текста', () => {
  let token = ''
  let projectId = ''

  const sheet =
    'Задняя стена 3200, левая стена 1900. Высота потолка 2,65 м. ' +
    'Глубина столешницы 600, высота столешницы 900. ' +
    'Холодильник 600, варочная панель 600, мойка 800. ' +
    'Вода 1200 от угла, канализация 1250.'

  before(async () => {
    const auth = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Замеры', name: 'Замерщик', email: 'measure@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
    const created = await api('/api/v1/projects', {
      method: 'POST',
      token,
      body: { title: 'Кухня — замеры' },
    })
    projectId = created.body.project.id
    await api(`/api/v1/projects/${projectId}/spec`, {
      method: 'POST',
      token,
      body: { spec: { ...completeSpec, layoutKind: 'corner' }, source: 'manual' },
    })
  })

  it('лист замеров перечисляет технику и точки подключения', async () => {
    const response = await api(`/api/v1/projects/${projectId}/measurements`, { token })
    assert.equal(response.status, 200)
    const ids = response.body.checklist.map((item: any) => item.id)
    assert.ok(ids.includes('sideRun'))
    assert.ok(ids.includes('appliance:fridge'))
    assert.ok(ids.includes('utility:drain'))
    // Техника и коммуникации ещё не замерены.
    assert.ok(response.body.summary.missing.length > 0)
  })

  it('разбирает текст замера, но спецификацию не меняет', async () => {
    const response = await api(`/api/v1/projects/${projectId}/measurements/parse`, {
      method: 'POST',
      token,
      body: { text: sheet },
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.usedModel, false)

    const byId = new Map(response.body.suggestions.map((item: any) => [item.id, item]))
    assert.equal((byId.get('roomWidth') as any).value, 3200)
    assert.equal((byId.get('roomHeight') as any).value, 2650)
    assert.equal((byId.get('appliance:fridge') as any).value, 600)
    assert.equal((byId.get('utility:drain') as any).value, 1250)
    // Каждое значение сопровождается фрагментом текста: его можно проверить.
    assert.ok((byId.get('roomWidth') as any).quote.includes('3200'))

    // Разбор ничего не записал.
    const after = await api(`/api/v1/projects/${projectId}/measurements`, { token })
    const fridge = after.body.checklist.find((item: any) => item.id === 'appliance:fridge')
    assert.equal(fridge.status, 'missing')
  })

  it('не берёт кредит, когда модель не участвовала', async () => {
    const before = await api('/api/v1/billing/wallet', { token })
    const response = await api(`/api/v1/projects/${projectId}/measurements/parse`, {
      method: 'POST',
      token,
      body: { text: sheet, useAi: true },
    })
    assert.equal(response.body.usedModel, false)
    const after = await api('/api/v1/billing/wallet', { token })
    assert.equal(after.body.wallet.available, before.body.wallet.available)
    assert.equal(after.body.wallet.reserved, 0)
  })

  it('подтверждённые значения получают статус замера', async () => {
    const response = await api(`/api/v1/projects/${projectId}/measurements/apply`, {
      method: 'POST',
      token,
      body: {
        accepted: [
          { id: 'roomWidth', value: 3200 },
          { id: 'appliance:fridge', value: 600 },
          { id: 'utility:drain', value: 1250 },
        ],
      },
    })
    assert.equal(response.status, 201)

    const checklist = new Map(response.body.checklist.map((item: any) => [item.id, item]))
    assert.equal((checklist.get('roomWidth') as any).status, 'confirmed')
    assert.equal((checklist.get('appliance:fridge') as any).value, 600)
    assert.equal((checklist.get('utility:drain') as any).status, 'confirmed')
    // Спецификация обновилась в той же черновой ревизии.
    assert.equal(response.body.createdNewRevision, false)
    assert.equal(response.body.revision.spec.appliances.length, 1)
  })

  it('помечает конфликт с уже подтверждённым значением', async () => {
    const response = await api(`/api/v1/projects/${projectId}/measurements/parse`, {
      method: 'POST',
      token,
      body: { text: 'Задняя стена 3400' },
    })
    const suggestion = response.body.suggestions.find((item: any) => item.id === 'roomWidth')
    assert.equal(suggestion.value, 3400)
    assert.equal(suggestion.current, 3200)
    assert.equal(suggestion.conflict, true)
  })

  it('отклоняет неизвестный замер', async () => {
    const response = await api(`/api/v1/projects/${projectId}/measurements/apply`, {
      method: 'POST',
      token,
      body: { accepted: [{ id: 'appliance:teleport', value: 600 }] },
    })
    assert.equal(response.status, 400)
  })

  it('не записывает значение вне разумного диапазона', async () => {
    await api(`/api/v1/projects/${projectId}/measurements/apply`, {
      method: 'POST',
      token,
      // Опечатка на порядок: холодильник шириной шесть метров.
      body: { accepted: [{ id: 'appliance:fridge', value: 6000 }] },
    })
    const after = await api(`/api/v1/projects/${projectId}/measurements`, { token })
    const fridge = after.body.checklist.find((item: any) => item.id === 'appliance:fridge')
    assert.equal(fridge.value, 600)
  })

  it('не пускает в производство, пока остались предположения', async () => {
    const response = await api(`/api/v1/projects/${projectId}/measurements`, { token })
    assert.equal(response.body.summary.readyForProduction, false)
    assert.ok(response.body.summary.missing.length > 0)
  })

  it('сохраняет историю диалога', async () => {
    const response = await api(`/api/v1/projects/${projectId}/messages`, { token })
    assert.ok(response.body.messages.length >= 2)
    const applied = response.body.messages.find((item: any) => item.source === 'apply')
    assert.ok(applied)
  })

  it('чужой проект недоступен', async () => {
    const other = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Чужие замеры', name: 'Гость', email: 'alien-measure@test.ru', password: 'parol12345' },
    })
    const response = await api(`/api/v1/projects/${projectId}/measurements`, {
      token: other.body.token,
    })
    assert.equal(response.status, 404)
  })

  it('после согласования подтверждение создаёт новую ревизию', async () => {
    // Доводим спецификацию до готовности и согласуем её.
    const revisions = await api(`/api/v1/projects/${projectId}/revisions`, { token })
    const current = revisions.body.revisions[0]
    const approved = await api(
      `/api/v1/projects/${projectId}/revisions/${current.id}/approve`,
      { method: 'POST', token, body: {} },
    )
    assert.equal(approved.status, 201)

    const response = await api(`/api/v1/projects/${projectId}/measurements/apply`, {
      method: 'POST',
      token,
      body: { accepted: [{ id: 'counterDepth', value: 620 }] },
    })
    assert.equal(response.body.createdNewRevision, true)
    assert.equal(response.body.revision.revisionNumber, 2)
    assert.equal(response.body.revision.spec.dimensions.counterDepth, 620)
  })
})

// --- M5: смета и снимок цен -------------------------------------------------

describe('Смета', () => {
  let token = ''
  let projectId = ''
  let facadeId = ''

  before(async () => {
    const auth = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Смета', name: 'Сметчик', email: 'estimate@test.ru', password: 'parol12345' },
    })
    token = auth.body.token
    projectId = await makeReadyProject(token, 'Кухня — смета')

    const facade = await api('/api/v1/catalog', {
      method: 'POST',
      token,
      body: {
        type: 'facade',
        name: 'Эмаль жемчужная',
        // 4 500 ₽ за м² — целыми копейками.
        salePriceKopecks: 450_000,
        priceUnit: 'square_metre',
        attributes: {
          material: 'enamel',
          colorName: 'Жемчуг',
          colorHex: '#EDE7DD',
          finish: 'matte',
          thicknessMm: 19,
        },
      },
    })
    facadeId = facade.body.item.id
  })

  it('считает по ценам каталога и сохраняет снимок', async () => {
    const response = await api(`/api/v1/projects/${projectId}/estimates`, {
      method: 'POST',
      token,
      body: {
        markupPercent: 30,
        lines: [
          {
            section: 'facade',
            catalogItemId: facadeId,
            name: 'Фасады',
            unit: 'square_metre',
            // 2,5 м²
            quantityMilli: 2500,
            note: '',
          },
        ],
      },
    })
    assert.equal(response.status, 201)

    const estimate = response.body.estimate
    assert.equal(estimate.lines[0].unitPriceKopecks, 450_000)
    // 2,5 × 4500 ₽ = 11 250 ₽
    assert.equal(estimate.lines[0].totalKopecks, 1_125_000)
    assert.equal(estimate.totals.materialsKopecks, 1_125_000)
    assert.equal(estimate.totals.markupKopecks, 337_500)
    assert.equal(estimate.totals.totalKopecks, 1_462_500)
    assert.equal(estimate.totals.missingPrices, 0)
  })

  it('помечает позицию без цены и не завышает сумму', async () => {
    const response = await api(`/api/v1/projects/${projectId}/estimates`, {
      method: 'POST',
      token,
      body: {
        markupPercent: 0,
        lines: [
          { section: 'facade', catalogItemId: facadeId, name: 'Фасады', unit: 'square_metre', quantityMilli: 1000, note: '' },
          { section: 'hardware', catalogItemId: null, name: 'Петля 110°', unit: 'piece', quantityMilli: 12000, note: '' },
        ],
      },
    })
    const estimate = response.body.estimate
    assert.equal(estimate.totals.missingPrices, 1)
    assert.equal(estimate.lines[1].priceMissing, true)
    assert.equal(estimate.lines[1].totalKopecks, 0)
    assert.equal(estimate.totals.totalKopecks, 450_000)
  })

  it('цена из запроса игнорируется', async () => {
    const response = await api(`/api/v1/projects/${projectId}/estimates`, {
      method: 'POST',
      token,
      body: {
        markupPercent: 0,
        lines: [
          {
            section: 'facade',
            catalogItemId: facadeId,
            name: 'Фасады',
            unit: 'square_metre',
            quantityMilli: 1000,
            note: '',
            // Попытка назначить свою цену из браузера.
            unitPriceKopecks: 1,
            totalKopecks: 1,
          },
        ],
      },
    })
    assert.equal(response.body.estimate.lines[0].unitPriceKopecks, 450_000)
    assert.equal(response.body.estimate.lines[0].totalKopecks, 450_000)
  })

  it('изменение цены в каталоге не трогает сохранённую смету', async () => {
    const before = await api(`/api/v1/projects/${projectId}/estimates`, { token })
    const saved = before.body.estimates[0]

    await api(`/api/v1/catalog/${facadeId}`, {
      method: 'PATCH',
      token,
      body: { salePriceKopecks: 900_000 },
    })

    const after = await api(`/api/v1/estimates/${saved.id}`, { token })
    assert.equal(after.body.estimate.lines[0].unitPriceKopecks, 450_000)
    assert.equal(after.body.estimate.totals.totalKopecks, saved.totals.totalKopecks)
  })

  it('чужая смета не отдаётся', async () => {
    const other = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Чужая смета', name: 'Гость', email: 'alien-estimate@test.ru', password: 'parol12345' },
    })
    const list = await api(`/api/v1/projects/${projectId}/estimates`, { token })
    const response = await api(`/api/v1/estimates/${list.body.estimates[0].id}`, {
      token: other.body.token,
    })
    assert.equal(response.status, 404)
  })
})

// --- M7: роли, права и сотрудники ------------------------------------------

describe('Роли и права', () => {
  let ownerToken = ''
  let estimatorToken = ''
  let constructorToken = ''
  let projectId = ''
  let estimatorId = ''

  async function invite(email: string, role: string) {
    const created = await api('/api/v1/users/invitations', {
      method: 'POST',
      token: ownerToken,
      body: { email, role },
    })
    assert.equal(created.status, 201)
    const accepted = await api('/api/v1/auth/accept-invitation', {
      method: 'POST',
      body: { token: created.body.token, name: email, password: 'parol12345' },
    })
    assert.equal(accepted.status, 201)
    return { token: accepted.body.token as string, userId: accepted.body.user.id as string }
  }

  before(async () => {
    const auth = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Роли', name: 'Хозяин', email: 'roles@test.ru', password: 'parol12345' },
    })
    ownerToken = auth.body.token
    // Пробный тариф рассчитан на двоих: для проверки ролей нужен тариф побольше.
    testDb()
      .prepare(
        `UPDATE subscriptions SET plan_id = 'plan_master'
          WHERE company_id = (SELECT company_id FROM users WHERE email = 'roles@test.ru')`,
      )
      .run()
    projectId = await makeReadyProject(ownerToken, 'Кухня — роли')

    const estimator = await invite('estimator@test.ru', 'estimator')
    estimatorToken = estimator.token
    estimatorId = estimator.userId
    constructorToken = (await invite('constructor@test.ru', 'constructor')).token
  })

  it('приглашённый попадает в ту же компанию со своей ролью', async () => {
    const me = await api('/api/v1/auth/me', { token: estimatorToken })
    assert.equal(me.body.user.role, 'estimator')

    const owner = await api('/api/v1/auth/me', { token: ownerToken })
    assert.equal(me.body.user.companyId, owner.body.user.companyId)
  })

  it('отдаёт список прав текущей роли', async () => {
    const response = await api('/api/v1/users/me/permissions', { token: constructorToken })
    assert.equal(response.body.role, 'constructor')
    assert.ok(response.body.permissions.includes('spec.edit'))
    assert.ok(!response.body.permissions.includes('catalog.edit'))
  })

  it('замерщик читает каталог, но не меняет его', async () => {
    const read = await api('/api/v1/catalog', { token: estimatorToken })
    assert.equal(read.status, 200)

    const write = await api('/api/v1/catalog', {
      method: 'POST',
      token: estimatorToken,
      body: {
        type: 'facade',
        name: 'Попытка',
        attributes: {
          material: 'enamel',
          colorName: 'Белый',
          colorHex: '#FFFFFF',
          finish: 'matte',
          thicknessMm: 19,
        },
      },
    })
    assert.equal(write.status, 403)
    assert.match(write.body.message, /владелец/i)
  })

  it('конструктор не запускает генерацию и не считает смету', async () => {
    const generation = await api(`/api/v1/projects/${projectId}/generations`, {
      method: 'POST',
      token: constructorToken,
      body: { quality: 'preview', variants: 1 },
    })
    assert.equal(generation.status, 403)

    const estimate = await api(`/api/v1/projects/${projectId}/estimates`, {
      method: 'POST',
      token: constructorToken,
      body: {
        markupPercent: 0,
        lines: [
          { section: 'facade', catalogItemId: null, name: 'Фасады', unit: 'square_metre', quantityMilli: 1000, note: '' },
        ],
      },
    })
    assert.equal(estimate.status, 403)
  })

  it('конструктор правит спецификацию, но не согласовывает ревизию', async () => {
    const spec = await api(`/api/v1/projects/${projectId}/spec`, {
      method: 'POST',
      token: constructorToken,
      body: { spec: completeSpec, source: 'manual' },
    })
    assert.equal(spec.status, 201)

    const revisions = await api(`/api/v1/projects/${projectId}/revisions`, { token: constructorToken })
    const approve = await api(
      `/api/v1/projects/${projectId}/revisions/${revisions.body.revisions[0].id}/approve`,
      { method: 'POST', token: constructorToken, body: {} },
    )
    assert.equal(approve.status, 403)
    assert.match(approve.body.message, /владелец/i)
  })

  it('замерщик не управляет сотрудниками', async () => {
    const response = await api('/api/v1/users', { token: estimatorToken })
    assert.equal(response.status, 403)
  })

  it('не принимает недействительное приглашение', async () => {
    const response = await api('/api/v1/auth/accept-invitation', {
      method: 'POST',
      body: { token: 'a'.repeat(43), name: 'Никто', password: 'parol12345' },
    })
    assert.equal(response.status, 400)
  })

  it('приглашение нельзя использовать дважды', async () => {
    const created = await api('/api/v1/users/invitations', {
      method: 'POST',
      token: ownerToken,
      body: { email: 'second@test.ru', role: 'constructor' },
    })
    const first = await api('/api/v1/auth/accept-invitation', {
      method: 'POST',
      body: { token: created.body.token, name: 'Второй', password: 'parol12345' },
    })
    assert.equal(first.status, 201)

    const again = await api('/api/v1/auth/accept-invitation', {
      method: 'POST',
      body: { token: created.body.token, name: 'Ещё раз', password: 'parol12345' },
    })
    assert.equal(again.status, 400)
  })

  it('в компании остаётся хотя бы один владелец', async () => {
    const users = await api('/api/v1/users', { token: ownerToken })
    const owner = users.body.users.find((user: any) => user.role === 'owner')
    const response = await api(`/api/v1/users/${owner.id}`, {
      method: 'PATCH',
      token: ownerToken,
      body: { role: 'estimator' },
    })
    assert.equal(response.status, 403)
    assert.match(response.body.message, /владелец/i)
  })

  it('отключение сотрудника обрывает его сессию', async () => {
    const before = await api('/api/v1/projects', { token: estimatorToken })
    assert.equal(before.status, 200)

    const disabled = await api(`/api/v1/users/${estimatorId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: { active: false },
    })
    assert.equal(disabled.status, 200)

    const after = await api('/api/v1/projects', { token: estimatorToken })
    assert.equal(after.status, 401)
  })

  it('чужие приглашения не видны', async () => {
    const other = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Чужая команда', name: 'Гость', email: 'alien-team@test.ru', password: 'parol12345' },
    })
    const response = await api('/api/v1/users/invitations', { token: other.body.token })
    assert.equal(response.status, 200)
    assert.equal(response.body.invitations.length, 0)
  })

})

describe('Лимит сотрудников по тарифу', () => {
  it('пробный тариф не пускает третьего сотрудника', async () => {
    const auth = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { companyName: 'Пробная', name: 'Хозяин', email: 'trial@test.ru', password: 'parol12345' },
    })
    const token = auth.body.token

    // Пробный тариф рассчитан на двоих: владелец и один сотрудник.
    const first = await api('/api/v1/users/invitations', {
      method: 'POST',
      token,
      body: { email: 'trial-one@test.ru', role: 'estimator' },
    })
    await api('/api/v1/auth/accept-invitation', {
      method: 'POST',
      body: { token: first.body.token, name: 'Первый', password: 'parol12345' },
    })

    const second = await api('/api/v1/users/invitations', {
      method: 'POST',
      token,
      body: { email: 'trial-two@test.ru', role: 'constructor' },
    })
    assert.equal(second.status, 409)
    assert.match(second.body.message, /тариф/i)
  })
})
