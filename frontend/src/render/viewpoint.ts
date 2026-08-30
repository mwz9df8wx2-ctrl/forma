import { clamp } from './palette.ts'

/**
 * Ракурс съёмки.
 *
 * Заказчику мало одной фронтальной картинки: он хочет увидеть изделие так,
 * как войдёт в комнату. Три четверти показывают глубину и торцы — по ним
 * видно, что кухня объёмная, а не наклейка на стене.
 */

export const VIEW_ANGLES = ['front', 'left', 'right'] as const
export type ViewAngle = (typeof VIEW_ANGLES)[number]

export const VIEW_ANGLE_LABELS: Record<ViewAngle, string> = {
  front: 'Фронтально',
  left: 'Три четверти слева',
  right: 'Три четверти справа',
}

/**
 * Доли ширины помещения: где стоит камера и куда она смотрит.
 * Разнос камеры и цели и создаёт угол — при совпадении вид фронтальный.
 */
const PLACEMENT: Record<ViewAngle, { eye: number; target: number; fovBoost: number }> = {
  // Даже «фронтальный» кадр снимают с лёгким смещением: строго осевой вид
  // выглядит чертежом, а перспективу по нему потом не восстановить —
  // сходящихся линий в кадре просто нет.
  front: { eye: 0.47, target: 0.515, fovBoost: 0 },
  left: { eye: 0.2, target: 0.66, fovBoost: 4 },
  right: { eye: 0.8, target: 0.34, fovBoost: 4 },
}

/** Ракурс по номеру варианта: три варианта — три разных взгляда. */
export function viewAngleForVariant(variant: number, requested?: ViewAngle): ViewAngle {
  if (requested) return requested
  return VIEW_ANGLES[((variant % VIEW_ANGLES.length) + VIEW_ANGLES.length) % VIEW_ANGLES.length]
}

export interface ViewpointInput {
  angle: ViewAngle
  /** Ширина помещения, м. */
  roomWidth: number
  /** Отступ камеры от ближней стены, м. */
  eyeDepth: number
  /** Глубина помещения, м: цель лежит у дальней стены. */
  roomDepth: number
  /** Высота камеры, м. */
  eyeHeight: number
  /** Высота точки, на которую смотрим, м. */
  targetHeight: number
  /** Базовый угол объектива по вертикали, градусы. */
  fov: number
}

export interface Viewpoint {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export function buildViewpoint(input: ViewpointInput): Viewpoint {
  const placement = PLACEMENT[input.angle]
  const W = input.roomWidth
  // Камеру держим внутри помещения: вплотную к стене объектив упирается
  // в неё же и половину кадра занимает пустая штукатурка.
  const eyeX = clamp(W * placement.eye, 0.45, W - 0.45)
  const targetX = clamp(W * placement.target, 0.3, W - 0.3)

  return {
    position: [eyeX, input.eyeHeight, input.eyeDepth],
    target: [targetX, input.targetHeight, input.roomDepth],
    fov: input.fov + placement.fovBoost,
  }
}
