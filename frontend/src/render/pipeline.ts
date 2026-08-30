import { analyzePhoto } from '../analysis/analyze.ts'
import { solveCamera, type CameraSolution } from '../analysis/camera.ts'
import type { PhotoAnalysis } from '../analysis/types.ts'
import {
  compositeOverPhoto,
  coverage,
  measurePhotoLuminance,
  measureRenderLuminance,
  repairUncoveredGaps,
} from './composite.ts'
import { developImage } from './post.ts'
import { renderImage } from './index.ts'
import { buildScene, type SceneInput } from './scene.ts'
import { renderScene } from './trace.ts'
import type { Dimensions } from '../types/index.ts'

/**
 * Конвейер «фотография → визуализация».
 *
 * Комната остаётся настоящей фотографией: считается и рисуется только кухня,
 * она же отбрасывает тень на реальный пол. Геометрия, перспектива, окна и
 * стены не перерисовываются, поэтому характерных ошибок генерации здесь нет.
 */

export interface PipelineOptions {
  photo: Uint8ClampedArray
  photoWidth: number
  photoHeight: number
  input: SceneInput
  dimensions: Dimensions
  aoSamples: number
  /** Готовый анализ снимка, если он уже посчитан. */
  analysis?: PhotoAnalysis
  onProgress?: (ratio: number) => void
}

export interface PipelineLog {
  /** Удалось ли вписать кухню в фотографию. */
  composited: boolean
  /** Почему вписывание не выполнено — текст для пользователя. */
  reason: string | null
  cameraHeight: number
  cameraDistance: number
  fov: number
  cameraSource: CameraSolution['source']
  cameraConfidence: number
  analysisConfidence: number
  coverage: number
  exposureGain: number
  notes: string[]
}

export interface PipelineResult {
  pixels: Uint8ClampedArray
  width: number
  height: number
  /** Маска покрытия кадра кухней — используется для проверок и отладки. */
  alphaMask: Float32Array
  analysis: PhotoAnalysis
  camera: CameraSolution
  log: PipelineLog
}

/** Точка на дальней стене, соответствующая точке кадра. */
function unprojectToWall(
  camera: CameraSolution,
  imageX: number,
  imageY: number,
  aspect: number,
): { x: number; y: number } | null {
  const [ox, oy, oz] = camera.position
  const [tx, ty, tz] = camera.target

  let fx = tx - ox
  let fy = ty - oy
  let fz = tz - oz
  const flen = Math.hypot(fx, fy, fz)
  fx /= flen
  fy /= flen
  fz /= flen

  let rx = fz
  const ry = 0
  let rz = -fx
  const rlen = Math.hypot(rx, ry, rz) || 1
  rx /= rlen
  rz /= rlen

  const ux = fy * rz - fz * ry
  const uy = fz * rx - fx * rz
  const uz = fx * ry - fy * rx

  const halfH = Math.tan(((camera.fov * Math.PI) / 180) * 0.5)
  const halfW = halfH * aspect

  const px = (2 * imageX - 1) * halfW
  const py = (1 - 2 * imageY) * halfH

  const dx = fx + rx * px + ux * py
  const dy = fy + ry * px + uy * py
  const dz = fz + rz * px + uz * py

  if (Math.abs(dz) < 1e-5) return null
  const t = (camera.roomDepth - oz) / dz
  if (t <= 0) return null

  return { x: ox + dx * t, y: oy + dy * t }
}

/** Окно с фотографии, перенесённое на плоскость дальней стены. */
function windowFromAnalysis(
  analysis: PhotoAnalysis,
  camera: CameraSolution,
  roomWidth: number,
  roomHeight: number,
  counterHeight: number,
): SceneInput['windowRect'] {
  const window = analysis.windows[0]
  if (!window || window.strength < 0.25) return null

  const aspect = analysis.width / analysis.height
  const topLeft = unprojectToWall(camera, window.x0, window.y0, aspect)
  const bottomRight = unprojectToWall(camera, window.x1, window.y1, aspect)
  if (!topLeft || !bottomRight) return null

  const x0 = Math.max(0.05, Math.min(topLeft.x, bottomRight.x))
  const x1 = Math.min(roomWidth - 0.05, Math.max(topLeft.x, bottomRight.x))
  let y0 = Math.max(0.35, Math.min(topLeft.y, bottomRight.y))
  const y1 = Math.min(roomHeight - 0.05, Math.max(topLeft.y, bottomRight.y))

  // Подоконник ниже столешницы физически невозможен; небольшой зазор
  // прижимаем к столешнице, заметный — оставляем и закрываем фартуком.
  if (y0 - counterHeight < 0.12) y0 = counterHeight + 0.02

  if (x1 - x0 < 0.3 || y1 - y0 < 0.3) return null
  return { x0, y0, x1, y1 }
}

export function renderIntoPhoto(options: PipelineOptions): PipelineResult {
  const { photo, photoWidth, photoHeight, dimensions, aoSamples, onProgress } = options

  const analysis = options.analysis ?? analyzePhoto(photo, photoWidth, photoHeight)
  onProgress?.(0.05)

  const camera = solveCamera(analysis, dimensions)

  // Снимок не подходит под фронтальную модель — вписывать нельзя.
  // Кривой композит выглядит хуже, чем честная отдельная визуализация.
  if (!analysis.suitability.composable || camera.confidence < 0.45) {
    const reason =
      analysis.suitability.reason ??
      'перспективу помещения не удалось разобрать уверенно'
    const standalone = renderImage(buildScene({ ...options.input, compositing: false }), photoWidth, photoHeight, {
      aoSamples,
      onProgress: (ratio) => onProgress?.(0.05 + ratio * 0.95),
    })
    return {
      pixels: standalone,
      width: photoWidth,
      height: photoHeight,
      alphaMask: new Float32Array(photoWidth * photoHeight),
      analysis,
      camera,
      log: {
        composited: false,
        reason,
        cameraHeight: camera.height,
        cameraDistance: camera.distance,
        fov: camera.fov,
        cameraSource: camera.source,
        cameraConfidence: camera.confidence,
        analysisConfidence: analysis.confidence,
        coverage: 1,
        exposureGain: 1,
        notes: camera.notes,
      },
    }
  }
  const roomWidth = Math.min(6.4, Math.max(2.4, dimensions.roomWidth / 1000))
  const roomHeight = Math.min(3.5, Math.max(2.35, dimensions.roomHeight / 1000))

  const input: SceneInput = {
    ...options.input,
    room: { width: roomWidth, height: roomHeight, depth: camera.roomDepth },
    compositing: true,
    camera: { position: camera.position, target: camera.target, fov: camera.fov },
    surfaces: analysis.colors,
    windowRect: windowFromAnalysis(
      analysis,
      camera,
      roomWidth,
      roomHeight,
      Math.min(1.06, Math.max(0.72, dimensions.counterHeight / 1000)),
    ),
    // Свет берём со снимка: его тон и характер уже соответствуют помещению.
    light: {
      warmth: options.input.light.warmth * 0.55 + analysis.light.warmth * 0.45,
      brightness: options.input.light.brightness * 0.6 + analysis.light.brightness * 0.4,
      contrast: options.input.light.contrast * 0.6 + analysis.light.contrast * 0.4,
    },
  }

  const scene = buildScene(input)
  scene.grain = 0.18

  const result = renderScene(scene, {
    width: photoWidth,
    height: photoHeight,
    aoSamples,
    onProgress: (ratio) => onProgress?.(0.05 + ratio * 0.85),
  })

  // Подгонка яркости: кухня не должна выглядеть вклеенной из другого кадра.
  const photoLuminance = measurePhotoLuminance(photo, result.alpha)
  const renderLuminance = measureRenderLuminance(result.color, result.alpha)
  const rawGain = renderLuminance > 0.001 ? photoLuminance / renderLuminance : 1
  const exposureGain = Math.min(1.7, Math.max(0.6, rawGain))

  const developed = developImage(result.color, photoWidth, photoHeight, {
    exposure: scene.exposure * exposureGain,
    contrast: scene.contrast,
    grain: scene.grain,
    seed: scene.seed,
    alpha: result.alpha,
    compositing: true,
  })

  // Сначала убираем остатки прежней кухни в просветах, затем накладываем новую.
  const band = analysis.kitchenBand ?? { top: 0.12, bottom: 0.95 }
  const repaired = repairUncoveredGaps(photo, result.alpha, photoWidth, photoHeight, band)
  const pixels = compositeOverPhoto(repaired, developed, photoWidth, photoHeight)
  onProgress?.(1)

  return {
    pixels,
    width: photoWidth,
    height: photoHeight,
    alphaMask: result.alpha,
    analysis,
    camera,
    log: {
      composited: true,
      reason: null,
      cameraHeight: camera.height,
      cameraDistance: camera.distance,
      fov: camera.fov,
      cameraSource: camera.source,
      cameraConfidence: camera.confidence,
      analysisConfidence: analysis.confidence,
      coverage: coverage(result.alpha),
      exposureGain,
      notes: camera.notes,
    },
  }
}
