import type {
  Generation,
  GenerationProgressEvent,
  GenerationProgressListener,
  GenerationRequestPayload,
  GenerationSubscription,
  ProjectPhoto,
} from '@/types'
import { buildUrl, request } from './client'
import { USE_MOCK_API } from './config'
import { mockBackend } from './mockBackend'
import { aiBackend } from './ai/aiBackend'
import { isAiReady } from './ai/settings'

/**
 * Откуда берётся визуализация:
 *  - server — рабочий бэкенд (VITE_USE_MOCK_API=false);
 *  - ai     — прямое подключение к сервису генерации с ключом пользователя;
 *  - local  — офлайн-движок в браузере, работает без сети.
 */
export type GenerationSource = 'server' | 'ai' | 'local'

export function getGenerationSource(): GenerationSource {
  if (!USE_MOCK_API) return 'server'
  return isAiReady() ? 'ai' : 'local'
}

export async function createGeneration(
  projectId: string,
  payload: GenerationRequestPayload,
  photo?: ProjectPhoto | null,
  seed?: number,
): Promise<Generation> {
  const source = getGenerationSource()
  if (source === 'ai' && photo) return aiBackend.createGeneration(projectId, payload, photo, seed)
  if (source !== 'server') return mockBackend.createGeneration(projectId, payload, photo, seed)
  return request<Generation>(`/projects/${projectId}/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, seed }),
  })
}

export async function getGeneration(id: string): Promise<Generation | null> {
  const source = getGenerationSource()
  if (source === 'ai' && aiBackend.owns(id)) return aiBackend.getGeneration(id)
  if (source !== 'server') return mockBackend.getGeneration(id)
  return request<Generation>(`/generations/${id}`)
}

/** Приводит ответ бэкенда к событию прогресса. */
function toEvent(generation: Generation): GenerationProgressEvent {
  return {
    generationId: generation.id,
    status: generation.status,
    stage: generation.stage,
    progress: generation.progress,
    results: generation.results,
    error: generation.error ?? undefined,
  }
}

/** Резервный транспорт: опрос статуса, если поток событий недоступен. */
function pollGeneration(
  generationId: string,
  listener: GenerationProgressListener,
): GenerationSubscription {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const tick = async () => {
    if (stopped) return
    try {
      const generation = await getGeneration(generationId)
      if (stopped) return
      if (generation) {
        listener(toEvent(generation))
        if (generation.status === 'completed' || generation.status === 'failed') return
      }
    } catch {
      listener({
        generationId,
        status: 'failed',
        error: { code: 'network', message: 'Нет соединения с сервером.' },
      })
      return
    }
    timer = setTimeout(tick, 2000)
  }

  void tick()

  return {
    close: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}

/**
 * Подписка на ход генерации.
 *
 * Транспорт скрыт за интерфейсом GenerationSubscription: демо-режим отдаёт
 * события из таймеров, продакшен — через Server-Sent Events с откатом на опрос.
 * Заменить SSE на WebSocket можно, не трогая UI.
 */
export function subscribeToGeneration(
  generationId: string,
  listener: GenerationProgressListener,
): GenerationSubscription {
  const source = getGenerationSource()
  // Если режим переключили после запуска, продолжаем тем источником, который её создал.
  if (source === 'ai' && aiBackend.owns(generationId)) {
    return aiBackend.subscribe(generationId, listener)
  }
  if (source !== 'server') return mockBackend.subscribe(generationId, listener)

  if (typeof EventSource === 'undefined') {
    return pollGeneration(generationId, listener)
  }

  let fallback: GenerationSubscription | null = null
  let closed = false
  const stream = new EventSource(buildUrl(`/generations/${generationId}/events`))

  stream.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data) as GenerationProgressEvent
      listener(parsed)
      if (parsed.status === 'completed' || parsed.status === 'failed') stream.close()
    } catch {
      /* некорректное событие игнорируем — статус придёт следующим сообщением */
    }
  }

  stream.onerror = () => {
    stream.close()
    if (closed || fallback) return
    fallback = pollGeneration(generationId, listener)
  }

  return {
    close: () => {
      closed = true
      stream.close()
      fallback?.close()
    },
  }
}
