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
