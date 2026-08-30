import { AppError } from '@/lib/errors'
import { dataUrlToBlob } from '@/lib/image'
import type { AiSettings } from './settings'

export interface AiGenerationRequest {
  prompt: string
  /** Исходная фотография помещения. */
  photoDataUrl: string
  variants: number
  signal?: AbortSignal
}

export interface AiProvider {
  id: string
  label: string
  generate: (request: AiGenerationRequest, settings: AiSettings) => Promise<string[]>
  test: (settings: AiSettings) => Promise<void>
}

function toDataUrl(base64: string): string {
  return `data:image/png;base64,${base64}`
}

/**
 * OpenAI Images — редактирование исходной фотографии по описанию.
 * Ключ передаётся из настроек устройства пользователя.
 */
const openAiProvider: AiProvider = {
  id: 'openai',
  label: 'OpenAI',

  async generate({ prompt, photoDataUrl, variants, signal }, settings) {
    const blob = await dataUrlToBlob(photoDataUrl)
    const form = new FormData()
    form.append('model', settings.model || 'gpt-image-1')
    form.append('image', blob, 'kitchen.jpg')
    form.append('prompt', prompt)
    form.append('n', String(Math.max(1, Math.min(4, variants))))
    form.append('size', settings.size)
    form.append('quality', 'high')

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
      body: form,
      signal,
    })

    if (!response.ok) {
      throw new AppError(response.status === 401 ? 'unavailable' : 'server', undefined, response.status)
    }

    const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> }
    const images = (payload.data ?? [])
      .map((item) => (item.b64_json ? toDataUrl(item.b64_json) : item.url))
      .filter((value): value is string => Boolean(value))

    if (images.length === 0) throw new AppError('unavailable')
    return images
  },

  async test(settings) {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
    })
    if (!response.ok) throw new AppError('unavailable')
  },
}

/**
 * Собственный сервис генерации: любой endpoint, принимающий JSON
 * { prompt, image, variants } и возвращающий { images: [dataUrl | url] }.
 */
const customProvider: AiProvider = {
  id: 'custom',
  label: 'Свой сервис',

  async generate({ prompt, photoDataUrl, variants, signal }, settings) {
    const response = await fetch(settings.endpoint.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey.trim() ? { Authorization: `Bearer ${settings.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({ prompt, image: photoDataUrl, variants }),
      signal,
    })

    if (!response.ok) throw new AppError('server', undefined, response.status)

    const payload = (await response.json()) as { images?: string[] }
    const images = payload.images ?? []
    if (images.length === 0) throw new AppError('unavailable')
    return images
  },

  async test(settings) {
    const response = await fetch(settings.endpoint.trim(), {
      method: 'OPTIONS',
    }).catch(() => null)
    if (!response) throw new AppError('network')
  },
}

export function getProvider(settings: AiSettings): AiProvider | null {
  if (settings.provider === 'openai') return openAiProvider
  if (settings.provider === 'custom') return customProvider
  return null
}
