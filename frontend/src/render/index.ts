export { buildScene, type SceneInput } from './scene.ts'
export { buildSceneFromParams, sceneInputFromParams } from './fromCatalog.ts'
export { renderScene, type RenderOptions, type RenderResult } from './trace.ts'
export { developImage, type PostOptions } from './post.ts'
export type * from './types.ts'

import { developImage } from './post.ts'
import { renderScene } from './trace.ts'
import type { SceneSpec } from './types.ts'

/** Полный проход: трассировка + проявка кадра. */
export function renderImage(
  scene: SceneSpec,
  width: number,
  height: number,
  options: {
    aoSamples?: number
    onProgress?: (ratio: number) => void
    /** Множитель экспозиции — используется для подгонки под яркость снимка. */
    exposureGain?: number
  } = {},
): Uint8ClampedArray {
  const result = renderScene(scene, {
    width,
    height,
    aoSamples: options.aoSamples,
    onProgress: options.onProgress,
  })
  return developImage(result.color, width, height, {
    exposure: scene.exposure * (options.exposureGain ?? 1),
    contrast: scene.contrast,
    grain: scene.grain,
    seed: scene.seed,
    alpha: scene.compositing ? result.alpha : undefined,
    compositing: scene.compositing,
  })
}
