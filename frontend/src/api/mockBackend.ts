import { createId } from '@/lib/id'
import { createThumbnail } from '@/lib/image'
import { readStorage, writeStorage } from '@/lib/storage'
import { buildSummary } from '@/lib/summary'
import { MOCK_CATALOG } from '@/mock/catalog'
import { createDemoProjects } from '@/mock/projects'
import {
  pickConcurrency,
  preparePhotoPixels,
  qualityProfile,
  renderVariant,
  type PreparedPhoto,
  type RenderHandle,
  type VariantResult,
} from '@/mock/visualization'
import type {
  Catalog,
  Generation,
  GenerationProgressListener,
  GenerationRequestPayload,
  GenerationResult,
  GenerationSubscription,
  Project,
  ProjectParams,
  ProjectPhoto,
} from '@/types'

/**
 * Демонстрационный бэкенд в памяти браузера.
 *
 * Полностью повторяет контракт реального API, поэтому переключение
 * на FastAPI сводится к VITE_USE_MOCK_API=false.
 */

const STORAGE_KEY = 'forma.projects.v1'
const VARIANTS_PER_GENERATION = 3

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface PersistedState {
  version: 1
  projects: Project[]
}

let memoryProjects: Project[] | null = null

function loadProjects(): Project[] {
  if (memoryProjects) return memoryProjects
  const stored = readStorage<PersistedState | null>(STORAGE_KEY, null)
  if (stored && Array.isArray(stored.projects)) {
    memoryProjects = stored.projects
  } else {
    memoryProjects = createDemoProjects()
    persist()
  }
  return memoryProjects
}

function persist(): void {
  if (!memoryProjects) return
  const state: PersistedState = { version: 1, projects: memoryProjects }
  writeStorage(STORAGE_KEY, state)
}

/**
 * В localStorage кладём облегчённую фотографию: полноразмерный снимок
 * остаётся в памяти текущей сессии и не переполняет квоту хранилища.
 */
async function lighten(project: Project): Promise<Project> {
  if (!project.photo || !project.photo.dataUrl.startsWith('data:image/jpeg')) return project
  try {
    const thumbnail = await createThumbnail(project.photo.dataUrl, 640)
    return { ...project, photo: { ...project.photo, dataUrl: thumbnail } }
  } catch {
    return project
  }
}

function payloadToParams(payload: GenerationRequestPayload): ProjectParams {
  return {
    // Категория приходит из проекта: по фотографии её не определить.
    category: payload.category ?? 'kitchen',
    viewAngle: payload.view_angle ?? 'auto',
    layoutKind: payload.layout_kind ?? 'straight',
    dimensions: payload.dimensions,
    materialId: payload.material_id,
    colorId: payload.color_id,
    textureId: payload.texture_id,
    paletteId: payload.palette_id,
    styleId: payload.style_id,
    countertopMaterialId: payload.countertop_id,
    countertopColorId: payload.countertop_color_id,
    lightingId: payload.lighting_id,
    options: payload.options,
  }
}

const generations = new Map<string, Generation>()
const generationParams = new Map<string, ProjectParams>()
const generationPhotos = new Map<string, ProjectPhoto>()
/** Зерно генерации: повторный запуск меняет только его. */
const generationSeeds = new Map<string, number>()

function toResult(generationId: string, index: number, variant: VariantResult): GenerationResult {
  return {
    id: `${generationId}_v${index + 1}`,
    index: index + 1,
    imageUrl: variant.dataUrl,
    thumbnailUrl: variant.dataUrl,
    width: variant.width,
    height: variant.height,
    isDemo: true,
  }
}

/**
 * Проверка результата на явные ошибки: пустой, чёрный или полностью
 * пересвеченный кадр, а также бессмысленное покрытие кухней.
 */
function looksBroken(variant: VariantResult): string | null {
  if (variant.width < 64 || variant.height < 64) return 'слишком маленький кадр'
  if (variant.stats.meanLuminance < 0.035) return 'кадр почти чёрный'
  if (variant.stats.meanLuminance > 0.965) return 'кадр пересвечен'
  if (variant.stats.variation < 0.02) return 'кадр однородный, без деталей'
  if (variant.log && (variant.log.coverage < 0.06 || variant.log.coverage > 0.97)) {
    return `кухня заняла ${(variant.log.coverage * 100).toFixed(0)}% кадра`
  }
  return null
}

export const mockBackend = {
  async getCatalog(): Promise<Catalog> {
    await delay(220)
    return MOCK_CATALOG
  },

  async listProjects(): Promise<Project[]> {
    await delay(180)
    return [...loadProjects()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  async getProject(id: string): Promise<Project | null> {
    await delay(120)
    return loadProjects().find((project) => project.id === id) ?? null
  },

  async createProject(title: string, params: ProjectParams): Promise<Project> {
    await delay(160)
    const now = new Date().toISOString()
    const project: Project = {
      id: createId('prj'),
      title,
      createdAt: now,
      updatedAt: now,
      photo: null,
      params,
      previewUrl: null,
      summary: buildSummary(MOCK_CATALOG, params),
      generationsCount: 0,
    }
    return project
  },

  async uploadPhoto(projectId: string, photo: ProjectPhoto): Promise<{ photoId: string }> {
    // Имитация загрузки: время зависит от веса подготовленного снимка.
    await delay(Math.min(1200, 320 + photo.sizeBytes / 4000))
    return { photoId: `${projectId}_photo` }
  },

  async saveProject(project: Project): Promise<Project> {
    const projects = loadProjects()
    const updated: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
      summary: buildSummary(MOCK_CATALOG, project.params),
    }
    const index = projects.findIndex((item) => item.id === project.id)
    if (index >= 0) projects[index] = updated
    else projects.unshift(updated)

    const light = await lighten(updated)
    const lightIndex = projects.findIndex((item) => item.id === project.id)
    const snapshot = projects.map((item, i) => (i === lightIndex ? light : item))
    memoryProjects = projects
    writeStorage(STORAGE_KEY, { version: 1, projects: snapshot } satisfies PersistedState)
    return updated
  },

  async deleteProject(id: string): Promise<void> {
    await delay(120)
    memoryProjects = loadProjects().filter((project) => project.id !== id)
    persist()
  },

  async createGeneration(
    projectId: string,
    payload: GenerationRequestPayload,
    photo?: ProjectPhoto | null,
    seed?: number,
  ): Promise<Generation> {
    await delay(280)
    const resolvedSeed = seed ?? Math.floor(Math.random() * 100000)
    const generation: Generation = {
      id: createId('gen'),
      projectId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      seed: resolvedSeed,
      stage: null,
      progress: 0,
      results: [],
      error: null,
    }
    generations.set(generation.id, generation)
    generationParams.set(generation.id, payloadToParams(payload))
    generationSeeds.set(generation.id, resolvedSeed)
    if (photo) generationPhotos.set(generation.id, photo)
    return generation
  },

  async getGeneration(id: string): Promise<Generation | null> {
    await delay(80)
    return generations.get(id) ?? null
  },

  /**
   * Ход генерации в демо-режиме.
   *
   * Прогресс здесь настоящий: три варианта считает офлайн-движок в фоновых
   * потоках. В продакшене на этом месте WebSocket или SSE — интерфейс подписки
   * тот же самый.
   */
  subscribe(generationId: string, listener: GenerationProgressListener): GenerationSubscription {
    const params = generationParams.get(generationId)
    const base = generations.get(generationId)
    let cancelled = false
    const handles: RenderHandle[] = []

    const emit = (patch: Partial<Generation>) => {
      if (cancelled) return
      const current = generations.get(generationId)
      const next: Generation = {
        ...(current ??
          ({
            id: generationId,
            projectId: '',
            status: 'queued',
            createdAt: new Date().toISOString(),
            seed: 0,
            stage: null,
            progress: 0,
            results: [],
            error: null,
          } satisfies Generation)),
        ...patch,
      }
      generations.set(generationId, next)
      listener({
        generationId,
        status: next.status,
        stage: next.stage,
        progress: next.progress,
        results: next.results,
        note: next.note ?? null,
        error: next.error ?? undefined,
      })
    }

    if (!base || !params) {
      const timer = setTimeout(() => {
        emit({
          status: 'failed',
          error: {
            code: 'unavailable',
            message: 'Не удалось создать визуализацию. Попробуйте ещё раз.',
          },
        })
      }, 200)
      return {
        close: () => {
          cancelled = true
          clearTimeout(timer)
        },
      }
    }

    const run = async () => {
      const profile = qualityProfile()
      const seed = generationSeeds.get(generationId) ?? 1
      const photo = generationPhotos.get(generationId)

      emit({ status: 'processing', stage: 'analyze', progress: 3 })

      // Фотография готовится один раз и передаётся всем вариантам.
      let prepared: PreparedPhoto | null = null
      if (photo) {
        try {
          prepared = await preparePhotoPixels(photo.dataUrl, profile.width)
        } catch {
          prepared = null
        }
      }
      if (cancelled) return

      emit({ status: 'processing', stage: 'materials', progress: 11 })
      await delay(320)
      if (cancelled) return

      emit({ status: 'processing', stage: 'interior', progress: 16 })

      const ratios = new Array<number>(VARIANTS_PER_GENERATION).fill(0)
      const results = new Array<GenerationResult | null>(VARIANTS_PER_GENERATION).fill(null)
      let note: string | null = null

      const report = () => {
        const total = ratios.reduce((sum, value) => sum + value, 0) / VARIANTS_PER_GENERATION
        emit({
          status: 'processing',
          stage: total > 0.45 ? 'render' : 'interior',
          progress: Math.round(16 + total * 82),
        })
      }

      const renderOnce = async (variant: number, attemptSeed: number, usePhoto: boolean) => {
        const handle = renderVariant({
          catalog: MOCK_CATALOG,
          params,
          variant,
          seed: attemptSeed,
          profile,
          dimensions: params.dimensions,
          photo: usePhoto ? prepared : null,
          onProgress: (ratio) => {
            ratios[variant] = ratio
            report()
          },
        })
        handles.push(handle)
        return handle.promise
      }

      const queue = Array.from({ length: VARIANTS_PER_GENERATION }, (_, index) => index)
      const workers = Array.from(
        { length: Math.min(pickConcurrency(), VARIANTS_PER_GENERATION) },
        async () => {
          while (queue.length > 0 && !cancelled) {
            const variant = queue.shift()
            if (variant === undefined) return

            let variantResult = await renderOnce(variant, seed, prepared !== null)
            let problem = looksBroken(variantResult)

            // Одна контролируемая повторная попытка: сначала с другим зерном,
            // а если снимок мешает — отдельной сценой без вписывания.
            if (problem && !cancelled) {
              console.warn(`[визуализация] вариант ${variant + 1}: ${problem}, повтор`)
              ratios[variant] = 0
              variantResult = await renderOnce(variant, seed + 977, false)
              problem = looksBroken(variantResult)
              if (problem) console.warn(`[визуализация] вариант ${variant + 1}: ${problem}`)
            }

            if (variantResult.log) {
              console.info('[визуализация] вариант', variant + 1, {
                зерно: seed + variant * 17,
                качество: profile.tier,
                размер: `${variantResult.width}×${variantResult.height}`,
                камера: `${variantResult.log.cameraHeight.toFixed(2)} м, ${variantResult.log.cameraDistance.toFixed(2)} м, ${variantResult.log.fov.toFixed(0)}°`,
                источникКамеры: variantResult.log.cameraSource,
                довериеКамеры: variantResult.log.cameraConfidence.toFixed(2),
                покрытие: `${(variantResult.log.coverage * 100).toFixed(0)}%`,
                экспозиция: variantResult.log.exposureGain.toFixed(2),
              })
            }

            if (variantResult.log && !variantResult.log.composited && !note) {
              note = variantResult.log.reason
            }
            // Замена мебели на снимке — то, чего заказчик и ждал: сообщаем,
            // сколько кадра пришлось освободить от прежней кухни.
            if (variantResult.log?.composited && variantResult.log.erased && !note) {
              note = `Прежняя мебель снята со снимка: ${Math.round(
                variantResult.log.erasedShare * 100,
              )}% кадра перерисовано.`
            }
            ratios[variant] = 1
            results[variant] = toResult(generationId, variant, variantResult)
            report()
          }
        },
      )

      await Promise.all(workers)
      if (cancelled) return

      emit({
        status: 'completed',
        stage: 'render',
        progress: 100,
        note,
        results: results.filter((item): item is GenerationResult => item !== null),
      })
    }

    void run().catch(() => {
      emit({
        status: 'failed',
        error: {
          code: 'unavailable',
          message: 'Не удалось создать визуализацию. Попробуйте ещё раз.',
        },
      })
    })

    return {
      close: () => {
        cancelled = true
        handles.forEach((handle) => handle.cancel())
      },
    }
  },
}
