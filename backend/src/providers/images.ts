import { createHash } from 'node:crypto'
import { env } from '../env.ts'
import { unavailable } from '../lib/errors.ts'
import { encodePng } from './png.ts'
import type { GenerationQuality } from '../../../shared/src/index.ts'

/**
 * Провайдер изображений.
 *
 * Абстракция нужна не ради красоты: тесты и разработка не должны тратить
 * деньги, а смена провайдера не должна переписывать очередь заданий.
 */

export interface ImageRequest {
  prompt: string
  variants: number
  quality: GenerationQuality
  size: '1024x1024' | '1536x1024' | '1024x1536'
  seed: number
  reference?: { data: Buffer; mime: string } | null
}

export interface GeneratedImage {
  data: Buffer
  mime: string
}

export interface ImageResult {
  images: GeneratedImage[]
  model: string
  /** Фактическая стоимость у провайдера, копейки. */
  actualCostKopecks: number
}

export interface ImageProvider {
  readonly name: string
  readonly model: string
  /** Оценка до вызова: по ней резервируются кредиты и проверяется бюджет. */
  estimateKopecks(request: ImageRequest): number
  generate(request: ImageRequest): Promise<ImageResult>
  /** Стоит ли повторять после этой ошибки. Ошибки запроса не повторяем. */
  isTransient(error: unknown): boolean
}

/**
 * Ориентировочная цена изображения у провайдера, копейки.
 * Держим здесь, а не в кредитах: кредиты можно подарить, счёт приходит настоящий.
 */
const PRICE_KOPECKS: Record<GenerationQuality, number> = {
  preview: 400,
  refine: 400,
  final: 1600,
}

function parseSize(size: ImageRequest['size']): [number, number] {
  const [w, h] = size.split('x').map(Number)
  return [w, h]
}

/**
 * Тестовый провайдер: детерминированное изображение по подсказке и зерну.
 * Один и тот же запрос даёт одни и те же байты — иначе тесты плавают.
 */
export class MockImageProvider implements ImageProvider {
  readonly name = 'mock'
  readonly model = 'mock-image-v1'

  estimateKopecks(): number {
    return 0
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    const [width, height] = parseSize(request.size)
    // Уменьшаем: тестам не нужен полный размер, а память нужна.
    const w = Math.round(width / 4)
    const h = Math.round(height / 4)
    const images: GeneratedImage[] = []
    for (let index = 0; index < request.variants; index += 1) {
      const hash = createHash('sha256')
        .update(`${request.prompt}|${request.seed}|${index}`)
        .digest()
      const base = [hash[0], hash[1], hash[2]]
      images.push({
        mime: 'image/png',
        data: encodePng(w, h, (x, y) => {
          const gradient = Math.round((y / h) * 60)
          const band = ((x / w) * 6) % 1 < 0.5 ? 12 : 0
          return [
            Math.min(255, base[0] / 2 + 90 + gradient + band),
            Math.min(255, base[1] / 2 + 84 + gradient + band),
            Math.min(255, base[2] / 2 + 78 + gradient),
          ]
        }),
      })
    }
    return { images, model: this.model, actualCostKopecks: 0 }
  }

  isTransient(): boolean {
    return false
  }
}

class ProviderHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Боевой провайдер. Ключ читается из окружения сервера и наружу не уходит. */
export class OpenAiImageProvider implements ImageProvider {
  readonly name = 'openai'
  readonly model = 'gpt-image-1'

  estimateKopecks(request: ImageRequest): number {
    return PRICE_KOPECKS[request.quality] * request.variants
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    if (!env.openAiKey) throw unavailable('Провайдер генерации не настроен на сервере')

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: request.prompt,
        n: request.variants,
        size: request.size,
        quality: request.quality === 'final' ? 'high' : 'medium',
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ProviderHttpError(response.status, text.slice(0, 500) || response.statusText)
    }

    const payload = (await response.json()) as { data?: { b64_json?: string }[] }
    const images: GeneratedImage[] = []
    for (const item of payload.data ?? []) {
      if (!item.b64_json) continue
      images.push({ data: Buffer.from(item.b64_json, 'base64'), mime: 'image/png' })
    }
    if (images.length === 0) throw new Error('Провайдер не вернул изображений')

    return {
      images,
      model: this.model,
      actualCostKopecks: PRICE_KOPECKS[request.quality] * images.length,
    }
  }

  /** Повторяем только то, что имеет шанс пройти со второго раза. */
  isTransient(error: unknown): boolean {
    if (error instanceof ProviderHttpError) {
      return error.status === 429 || error.status >= 500
    }
    return error instanceof TypeError // обрыв сети в fetch
  }
}

let override: ImageProvider | null = null

/** Подмена провайдера в тестах: боевые ключи в тестах не участвуют. */
export function setImageProvider(provider: ImageProvider | null): void {
  override = provider
}

export function imageProvider(): ImageProvider {
  if (override) return override
  if (!env.openAiKey) return new MockImageProvider()
  return new OpenAiImageProvider()
}
