import type { FurnitureCategory } from '@shared/index'
import type { Dimensions, OptionValues } from './project'

export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type GenerationStageId = 'analyze' | 'materials' | 'interior' | 'render'

export interface GenerationStage {
  id: GenerationStageId
  /** Человеческая формулировка. Никаких технических терминов. */
  label: string
}

/**
 * Структурированные параметры, которые фронтенд отправляет на бэкенд.
 * Prompt Builder живёт на бэкенде — фронтенд не формирует текст запроса к ИИ.
 */
export interface GenerationRequestPayload {
  /** Что визуализируем: кухня, шкаф или тумба. */
  category: FurnitureCategory
  /** Планировка фронта: прямая или угловая. */
  layout_kind: 'straight' | 'corner'
  material_id: string
  color_id: string
  palette_id: string
  texture_id: string
  style_id: string
  countertop_id: string
  countertop_color_id: string
  lighting_id: string
  dimensions: Dimensions
  options: OptionValues
}

export interface GenerationResult {
  id: string
  /** Порядковый номер варианта, начиная с 1. */
  index: number
  imageUrl: string
  thumbnailUrl: string
  width: number
  height: number
  /** Визуализация получена в демонстрационном режиме, без бэкенда. */
  isDemo: boolean
}

export interface GenerationError {
  code: 'unavailable' | 'network' | 'server' | 'cancelled' | 'unknown'
  message: string
}

export interface Generation {
  id: string
  projectId: string
  status: GenerationStatus
  createdAt: string
  /** Зерно расчёта: позволяет воспроизвести тот же результат. */
  seed: number
  stage: GenerationStageId | null
  /** null — прогресс неизвестен, показываем indeterminate индикатор. */
  progress: number | null
  results: GenerationResult[]
  error: GenerationError | null
  /** Пояснение к результату: например, почему кухню не вписали в фотографию. */
  note?: string | null
}

/** Событие прогресса: приходит из mock-транспорта, WebSocket или SSE. */
export interface GenerationProgressEvent {
  generationId: string
  status: GenerationStatus
  stage?: GenerationStageId | null
  progress?: number | null
  results?: GenerationResult[]
  error?: GenerationError
  note?: string | null
}

export type GenerationProgressListener = (event: GenerationProgressEvent) => void

/** Подписка на прогресс генерации. Транспорт скрыт за этим интерфейсом. */
export interface GenerationSubscription {
  close: () => void
}
