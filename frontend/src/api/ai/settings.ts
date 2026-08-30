import { readStorage, removeStorage, writeStorage } from '@/lib/storage'

export type AiProviderId = 'none' | 'openai' | 'custom'

export interface AiSettings {
  provider: AiProviderId
  /** Ключ хранится только в браузере пользователя и никогда не попадает в сборку. */
  apiKey: string
  model: string
  /** Адрес собственного сервиса генерации для провайдера «custom». */
  endpoint: string
  size: '1024x1024' | '1536x1024' | '1024x1536'
  variants: number
  /**
   * Claude отвечает за разбор фотографии и подбор параметров, а не за
   * генерацию изображений — это отдельный ключ и отдельная возможность.
   */
  claudeApiKey: string
  claudeModel: string
}

const STORAGE_KEY = 'forma.ai.v1'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'none',
  apiKey: '',
  model: 'gpt-image-1',
  endpoint: '',
  size: '1536x1024',
  variants: 2,
  claudeApiKey: '',
  claudeModel: 'claude-opus-5',
}

export function loadAiSettings(): AiSettings {
  const stored = readStorage<Partial<AiSettings>>(STORAGE_KEY, {})
  return { ...DEFAULT_AI_SETTINGS, ...stored }
}

export function saveAiSettings(settings: AiSettings): void {
  writeStorage(STORAGE_KEY, settings)
}

export function clearAiSettings(): void {
  removeStorage(STORAGE_KEY)
}

/** Подключён ли разбор снимков через Claude. */
export function isClaudeReady(settings: AiSettings = loadAiSettings()): boolean {
  return settings.claudeApiKey.trim().length > 20
}

/** Готов ли режим ИИ к работе. */
export function isAiReady(settings: AiSettings = loadAiSettings()): boolean {
  if (settings.provider === 'openai') return settings.apiKey.trim().length > 20
  if (settings.provider === 'custom') return settings.endpoint.trim().startsWith('http')
  return false
}
