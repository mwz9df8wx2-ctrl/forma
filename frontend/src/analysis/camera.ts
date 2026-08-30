import type { PhotoAnalysis } from './types.ts'
import type { Dimensions } from '../types/index.ts'

/**
 * Расчёт положения камеры по фотографии.
 *
 * Опора — не только точка схода, но и размеры помещения, которые ввёл замерщик.
 * Дальняя стена известной ширины и высоты, её видимый размер в кадре и линия
 * пола однозначно задают расстояние и высоту съёмки при выбранном угле обзора.
 */

export interface CameraSolution {
  position: [number, number, number]
  target: [number, number, number]
  /** Вертикальный угол обзора, градусы. */
  fov: number
  /** Расстояние от камеры до дальней стены, м. */
  distance: number
  /** Глубина помещения, подобранная так, чтобы камера стояла внутри. */
  roomDepth: number
  /** Высота съёмки, м. */
  height: number
  confidence: number
  source: 'photo' | 'default'
  notes: string[]
}

const DEFAULT_CAMERA_HEIGHT = 1.55
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function solveCamera(analysis: PhotoAnalysis, dimensions: Dimensions): CameraSolution {
  const notes: string[] = []
  const imageWidth = analysis.width
  const imageHeight = analysis.height

  const roomWidth = clamp(dimensions.roomWidth / 1000, 2.4, 6.4)
  const counterHeight = clamp(dimensions.counterHeight / 1000, 0.72, 1.06)

  /** Куда попадает точка дальней стены высотой Y при данных параметрах. */
  const project = (Y: number, h: number, tilt: number, distance: number, halfH: number): number => {
    const sin = Math.sin(tilt)
    const cos = Math.cos(tilt)
    const dy = Y - h
    const along = -dy * sin + distance * cos
    if (Math.abs(along) < 1e-6) return 0.5
    const py = (dy * cos + distance * sin) / along
    return (1 - py / halfH) / 2
  }

  /** Высота камеры, при которой линия пола ложится точно на снимок. */
  const heightForFloor = (tilt: number, distance: number, halfH: number, floorY: number) => {
    const k = halfH * (1 - 2 * floorY)
    const sin = Math.sin(tilt)
    const cos = Math.cos(tilt)
    const denominator = cos + k * sin
    if (Math.abs(denominator) < 1e-4) return null
    return (distance * (sin - k * cos)) / denominator
  }

  // Угол обзора и высоту съёмки по одному кадру не восстановить: они подменяют
  // друг друга. Берём их как априорные (типовой телефон, съёмка стоя) и решаем
  // наклон камеры и расстояние по двум надёжным линиям — полу и столешнице.
  const PRIOR_FOV = (65 * Math.PI) / 180
  const focalPrior = imageWidth / 2 / Math.tan(PRIOR_FOV / 2)
  const halfHPrior = imageHeight / 2 / focalPrior

  let bestFov = PRIOR_FOV
  let bestTilt = 0
  let bestDistance = 0
  let bestHeight = DEFAULT_CAMERA_HEIGHT
  let bestError = Number.POSITIVE_INFINITY
  let solved = false

  const fallbackSpanPx = analysis.counterSpan
    ? (analysis.counterSpan.right - analysis.counterSpan.left) * imageWidth
    : analysis.wallSpan
      ? (analysis.wallSpan.right - analysis.wallSpan.left) * imageWidth
      : 0.92 * imageWidth

  // Съёмка ведётся внутри помещения: расстояние до стены не может сильно
  // превышать ширину комнаты, иначе кухня уезжает вглубь кадра.
  const distanceMin = Math.max(1.4, roomWidth * 0.45)
  const distanceMax = clamp(roomWidth * 1.9, 2.6, 8)
  let atBoundary = false

  if (analysis.floorLineY !== null && analysis.counterLineY !== null) {
    for (let distance = distanceMin; distance <= distanceMax; distance += 0.02) {
      for (let degrees = -14; degrees <= 14; degrees += 0.1) {
        const tilt = (degrees * Math.PI) / 180
        // Высота, при которой стык пола ложится точно на снимок.
        const height = heightForFloor(tilt, distance, halfHPrior, analysis.floorLineY)
        if (height === null || height < 1.15 || height > 2.0) continue

        const predicted = project(counterHeight, height, tilt, distance, halfHPrior)
        let error = Math.abs(predicted - analysis.counterLineY) * 60
        // Держим высоту около обычной: это разрешает остаточную неоднозначность.
        error += Math.abs(height - DEFAULT_CAMERA_HEIGHT) * 1.4

        if (error < bestError) {
          bestError = error
          bestTilt = tilt
          bestDistance = distance
          bestHeight = height
          solved = true
        }
      }
    }
  }

  if (solved && (bestDistance <= distanceMin + 0.05 || bestDistance >= distanceMax - 0.05)) {
    // Решение упёрлось в границу поиска — доверять ему нельзя.
    atBoundary = true
    solved = false
    notes.push('решение по линиям вышло за разумные пределы, взята оценка по ширине кадра')
  }

  if (!solved && analysis.floorLineY !== null) {
    // Столешницу не нашли: расстояние по видимой ширине, высота типовая.
    const distance = clamp((focalPrior * roomWidth) / fallbackSpanPx, distanceMin, distanceMax)
    for (let degrees = -14; degrees <= 14; degrees += 0.1) {
      const tilt = (degrees * Math.PI) / 180
      const height = heightForFloor(tilt, distance, halfHPrior, analysis.floorLineY)
      if (height === null || height < 1.15 || height > 2.0) continue
      const error = Math.abs(height - DEFAULT_CAMERA_HEIGHT)
      if (error < bestError) {
        bestError = error
        bestTilt = tilt
        bestDistance = distance
        bestHeight = height
        solved = true
      }
    }
    if (solved) notes.push('кромка столешницы не найдена, расстояние взято по ширине кадра')
  }

  if (!solved) {
    bestDistance = clamp((focalPrior * roomWidth) / fallbackSpanPx, distanceMin, distanceMax)
    bestHeight = DEFAULT_CAMERA_HEIGHT
    const horizonPx = analysis.vanishing ? analysis.horizonY * imageHeight : imageHeight / 2
    bestTilt = Math.atan((imageHeight / 2 - horizonPx) / focalPrior)
    notes.push('линия пола не найдена, взяты типовые параметры съёмки')
  } else {
    notes.push(
      `решено по линиям: высота ${bestHeight.toFixed(2)} м, наклон ${((bestTilt * 180) / Math.PI).toFixed(1)}°, до стены ${bestDistance.toFixed(2)} м`,
    )
  }

  const focal = imageWidth / 2 / Math.tan(bestFov / 2)
  const verticalFov = 2 * Math.atan(imageHeight / 2 / focal)
  const distance = clamp(bestDistance, distanceMin, distanceMax)
  const cameraHeight = clamp(bestHeight, 1.1, 2.0)

  // Смещение камеры вбок: центр стены относительно центра кадра.
  const wallCentre = analysis.counterSpan
    ? ((analysis.counterSpan.left + analysis.counterSpan.right) / 2) * imageWidth
    : analysis.wallSpan
      ? ((analysis.wallSpan.left + analysis.wallSpan.right) / 2) * imageWidth
      : imageWidth / 2
  const lateral = ((wallCentre - imageWidth / 2) * distance) / focal
  const cameraX = clamp(roomWidth / 2 - lateral, 0.35, roomWidth - 0.35)

  const roomDepth = clamp(distance + 0.45, 2.6, 9)

  const confidence = clamp(
    (solved ? 0.45 : 0) -
      (atBoundary ? 0.2 : 0) +
      analysis.confidence * 0.25 +
      (analysis.counterSpan ? 0.2 : 0) +
      (analysis.counterLineY !== null ? 0.1 : 0) +
      (analysis.ceilingLineY !== null ? 0.06 : 0),
    0,
    1,
  )

  return {
    position: [cameraX, cameraHeight, roomDepth - distance],
    target: [cameraX, cameraHeight - distance * Math.tan(bestTilt), roomDepth],
    fov: (verticalFov * 180) / Math.PI,
    distance,
    roomDepth,
    height: cameraHeight,
    confidence,
    source: solved ? 'photo' : 'default',
    notes,
  }
}
