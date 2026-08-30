/// <reference lib="webworker" />
import { buildScene, type SceneInput } from './scene.ts'
import { renderImage } from './index.ts'
import { renderIntoPhoto, type PipelineLog } from './pipeline.ts'
import type { Dimensions } from '../types/index.ts'

/** Задание на рендер одного варианта визуализации. */
export interface RenderRequest {
  id: string
  input: SceneInput
  width: number
  height: number
  aoSamples?: number
  /**
   * Фотография помещения. Если она есть, кухня вписывается в неё:
   * комната остаётся настоящей, меняется только мебель.
   */
  photo?: { pixels: ArrayBuffer; width: number; height: number }
  dimensions?: Dimensions
}

export type RenderResponse =
  | { id: string; type: 'progress'; ratio: number }
  | {
      id: string
      type: 'done'
      pixels: ArrayBuffer
      width: number
      height: number
      log?: PipelineLog
    }
  | { id: string; type: 'error'; message: string }

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, input, width, height, aoSamples, photo, dimensions } = event.data
  try {
    let lastSent = 0
    const onProgress = (ratio: number) => {
      // Не засыпаем главный поток сообщениями.
      if (ratio - lastSent < 0.04 && ratio < 1) return
      lastSent = ratio
      scope.postMessage({ id, type: 'progress', ratio } satisfies RenderResponse)
    }

    let rgba: Uint8ClampedArray
    let outWidth = width
    let outHeight = height
    let log: PipelineLog | undefined

    if (photo && dimensions) {
      const result = renderIntoPhoto({
        photo: new Uint8ClampedArray(photo.pixels),
        photoWidth: photo.width,
        photoHeight: photo.height,
        input,
        dimensions,
        aoSamples: aoSamples ?? 3,
        onProgress,
      })
      rgba = result.pixels
      outWidth = result.width
      outHeight = result.height
      log = result.log
    } else {
      rgba = renderImage(buildScene(input), width, height, { aoSamples, onProgress })
    }

    const buffer = rgba.buffer as ArrayBuffer
    scope.postMessage(
      { id, type: 'done', pixels: buffer, width: outWidth, height: outHeight, log } satisfies RenderResponse,
      [buffer],
    )
  } catch (error) {
    scope.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'render failed',
    } satisfies RenderResponse)
  }
}
