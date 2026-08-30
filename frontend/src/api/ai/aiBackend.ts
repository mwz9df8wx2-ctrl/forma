import { createId } from '@/lib/id'
import { toAppError } from '@/lib/errors'
import type {
  Generation,
  GenerationProgressListener,
  GenerationRequestPayload,
  GenerationSubscription,
  ProjectParams,
  ProjectPhoto,
} from '@/types'
import { getCatalog } from '../catalog'
import { buildAiPrompt } from './prompt'
import { getProvider } from './providers'
import { loadAiSettings } from './settings'

/**
 * Прямое подключение к сервису генерации изображений.
 *
 * Используется, когда своего бэкенда ещё нет: ключ пользователя хранится
 * на его устройстве, запрос уходит напрямую провайдеру.
 */

const generations = new Map<string, Generation>()
const contexts = new Map<string, { params: ProjectParams; photo: ProjectPhoto }>()

function payloadToParams(payload: GenerationRequestPayload): ProjectParams {
  return {
    // Раскладку по фотографии строим только для кухни: другие категории
    // задаются в проекте и не выводятся из снимка.
    category: 'kitchen',
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

/** Этапы сменяются по времени: провайдер не сообщает ход выполнения. */
const STAGE_TIMELINE: Array<{ delay: number; stage: Generation['stage'] }> = [
  { delay: 600, stage: 'analyze' },
  { delay: 4000, stage: 'materials' },
  { delay: 9000, stage: 'interior' },
  { delay: 15000, stage: 'render' },
]

export const aiBackend = {
  async createGeneration(
    projectId: string,
    payload: GenerationRequestPayload,
    photo: ProjectPhoto,
    seed?: number,
  ): Promise<Generation> {
    const generation: Generation = {
      id: createId('gen'),
      projectId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      seed: seed ?? Math.floor(Math.random() * 100000),
      stage: null,
      // Провайдер не отдаёт прогресс — показываем бесконечный индикатор.
      progress: null,
      results: [],
      error: null,
    }
    generations.set(generation.id, generation)
    contexts.set(generation.id, { params: payloadToParams(payload), photo })
    return generation
  },

  async getGeneration(id: string): Promise<Generation | null> {
    return generations.get(id) ?? null
  },

  /** Была ли генерация создана этим источником. */
  owns(id: string): boolean {
    return contexts.has(id)
  },

  subscribe(generationId: string, listener: GenerationProgressListener): GenerationSubscription {
    const context = contexts.get(generationId)
    const base = generations.get(generationId)
    const controller = new AbortController()
    const timers: ReturnType<typeof setTimeout>[] = []
    let closed = false
    /** После завершения или ошибки таймеры этапов не должны менять статус. */
    let settled = false

    const emit = (patch: Partial<Generation>) => {
      if (closed) return
      if (settled && patch.status === 'processing') return
      if (patch.status === 'completed' || patch.status === 'failed') {
        settled = true
        timers.forEach(clearTimeout)
      }
      const current = generations.get(generationId) ?? base
      if (!current) return
      const next: Generation = { ...current, ...patch }
      generations.set(generationId, next)
      listener({
        generationId,
        status: next.status,
        stage: next.stage,
        progress: next.progress,
        results: next.results,
        error: next.error ?? undefined,
      })
    }

    if (!context || !base) {
      timers.push(
        setTimeout(
          () =>
            emit({
              status: 'failed',
              error: { code: 'unavailable', message: 'Не удалось создать визуализацию. Попробуйте ещё раз.' },
            }),
          200,
        ),
      )
      return {
        close: () => {
          closed = true
          timers.forEach(clearTimeout)
        },
      }
    }

    for (const step of STAGE_TIMELINE) {
      timers.push(
        setTimeout(() => emit({ status: 'processing', stage: step.stage, progress: null }), step.delay),
      )
    }

    const run = async () => {
      const settings = loadAiSettings()
      const provider = getProvider(settings)
      if (!provider) throw new Error('provider not configured')

      const catalog = await getCatalog()
      const prompt = buildAiPrompt(catalog, context.params)

      const images = await provider.generate(
        {
          prompt,
          photoDataUrl: context.photo.dataUrl,
          variants: settings.variants,
          signal: controller.signal,
        },
        settings,
      )

      if (closed) return

      emit({
        status: 'completed',
        stage: 'render',
        progress: 100,
        results: images.map((imageUrl, index) => ({
          id: `${generationId}_v${index + 1}`,
          index: index + 1,
          imageUrl,
          thumbnailUrl: imageUrl,
          width: 1536,
          height: 1024,
          isDemo: false,
        })),
      })
    }

    void run().catch((cause) => {
      if (closed) return
      const error = toAppError(cause, 'unavailable')
      emit({
        status: 'failed',
        error: { code: error.code === 'network' ? 'network' : 'unavailable', message: error.message },
      })
    })

    return {
      close: () => {
        closed = true
        controller.abort()
        timers.forEach(clearTimeout)
      },
    }
  },
}
