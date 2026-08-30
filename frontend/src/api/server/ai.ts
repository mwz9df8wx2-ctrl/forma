import { serverRequest } from './client'

/** Что сервер умеет прямо сейчас. Ключи провайдеров сюда не попадают. */
export interface AiCapabilities {
  generationEnabled: boolean
  analysisEnabled: boolean
  provider: string
  model: string | null
  /** true — на сервере нет ключа, работает тестовый провайдер. */
  demo: boolean
  reason: string | null
}

export async function fetchCapabilities(): Promise<AiCapabilities> {
  return serverRequest<AiCapabilities>('/ai/capabilities')
}
