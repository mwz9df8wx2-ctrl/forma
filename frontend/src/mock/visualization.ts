import { createId } from '@/lib/id'
import { sceneInputFromParams } from '@/render'
import type { PipelineLog } from '@/render/pipeline'
import type { RenderRequest, RenderResponse } from '@/render/render.worker'
import { qualityProfile, type QualityProfile } from './quality'
import type { Catalog, Dimensions, ProjectParams } from '@/types'

/**
 * Запуск офлайн-рендера в фоновых потоках.
 *
 * Если есть фотография помещения, кухня вписывается прямо в неё: комната
 * остаётся настоящим снимком, меняется только мебель. Тяжёлый расчёт идёт
 * в Web Worker и не блокирует интерфейс.
 */

export interface PreparedPhoto {
  pixels: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}

/** Сколько вариантов считать одновременно. */
export function pickConcurrency(): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  return Math.max(1, Math.min(3, cores - 1))
}

/** Размер кадра под выбранное качество и пропорции снимка. */
export function renderSize(profile: QualityProfile, aspect = 1.5): { width: number; height: number } {
  const width = profile.width
  return { width, height: Math.max(240, Math.round(width / aspect)) }
}

/** Фотография в пиксели нужного размера — их получает рабочий поток. */
export async function preparePhotoPixels(
  dataUrl: string,
  targetWidth: number,
): Promise<PreparedPhoto> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)

  const width = Math.min(targetWidth, bitmap.width)
  const height = Math.max(1, Math.round((width * bitmap.height) / bitmap.width))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas unavailable')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const data = context.getImageData(0, 0, width, height)
  return { pixels: data.data as Uint8ClampedArray<ArrayBuffer>, width, height }
}

function pixelsToDataUrl(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas unavailable')
  context.putImageData(new ImageData(pixels, width, height), 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export interface VariantStats {
  meanLuminance: number
  /** Доля пикселей, отличающихся от среднего: нулевая означает пустой кадр. */
  variation: number
}

export interface VariantResult {
  dataUrl: string
  width: number
  height: number
  log?: PipelineLog
  stats: VariantStats
}

/** Быстрая оценка кадра — основа проверки результата на осмысленность. */
function measure(pixels: Uint8ClampedArray, width: number, height: number): VariantStats {
  let sum = 0
  let squares = 0
  let count = 0
  const step = Math.max(1, Math.floor((width * height) / 20000))
  for (let i = 0; i < width * height; i += step) {
    const o = i * 4
    const luminance = (0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]) / 255
    sum += luminance
    squares += luminance * luminance
    count += 1
  }
  const mean = count > 0 ? sum / count : 0
  const variance = count > 0 ? Math.max(0, squares / count - mean * mean) : 0
  return { meanLuminance: mean, variation: Math.sqrt(variance) }
}

export interface RenderHandle {
  promise: Promise<VariantResult>
  cancel: () => void
}

export interface VariantOptions {
  catalog: Catalog
  params: ProjectParams
  variant: number
  seed: number
  profile: QualityProfile
  dimensions: Dimensions
  /** Подготовленная фотография: без неё считается отдельная сцена. */
  photo?: PreparedPhoto | null
  onProgress?: (ratio: number) => void
}

/** Рендер одного варианта. */
export function renderVariant(options: VariantOptions): RenderHandle {
  const { catalog, params, variant, seed, profile, dimensions, photo, onProgress } = options
  const worker = new Worker(new URL('../render/render.worker.ts', import.meta.url), {
    type: 'module',
  })
  const id = createId('render')
  const aspect = photo ? photo.width / photo.height : 1.5
  const { width, height } = renderSize(profile, aspect)

  const promise = new Promise<VariantResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<RenderResponse>) => {
      const message = event.data
      if (message.id !== id) return
      if (message.type === 'progress') {
        onProgress?.(message.ratio)
        return
      }
      if (message.type === 'error') {
        worker.terminate()
        reject(new Error(message.message))
        return
      }
      try {
        const pixels = new Uint8ClampedArray(message.pixels) as Uint8ClampedArray<ArrayBuffer>
        resolve({
          dataUrl: pixelsToDataUrl(pixels, message.width, message.height),
          width: message.width,
          height: message.height,
          log: message.log,
          stats: measure(pixels, message.width, message.height),
        })
      } catch (error) {
        reject(error instanceof Error ? error : new Error('render failed'))
      } finally {
        worker.terminate()
      }
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('render worker failed'))
    }

    const input = sceneInputFromParams(catalog, params, variant, profile.sceneQuality)
    // Зерно фиксируем явно: повторная генерация меняет только его.
    input.seed = seed + variant * 17

    const request: RenderRequest = {
      id,
      input,
      width,
      height,
      aoSamples: profile.aoSamples,
      ...(photo
        ? {
            photo: { pixels: photo.pixels.buffer, width: photo.width, height: photo.height },
            dimensions,
          }
        : {}),
    }

    // Пиксели фотографии копируем: один и тот же снимок нужен всем вариантам.
    worker.postMessage(request)
  })

  return { promise, cancel: () => worker.terminate() }
}

export { qualityProfile }
