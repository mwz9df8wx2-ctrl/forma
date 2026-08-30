export type PatternKind =
  | 'paint'
  | 'wood'
  | 'veneer'
  | 'gloss'
  | 'stone'
  | 'marble'
  | 'speck'
  | 'linear'
  | 'wall'
  | 'floor'
  | 'tile'
  | 'metal'
  | 'dark-glass'

export interface PanelLayout {
  /** Ширина одной дверцы, м. */
  doorWidth: number
  /** Ширина шва между дверцами, м. */
  gap: number
  handle: 'hidden' | 'bar' | 'knob'
  /** Филёнка на фасаде. */
  frame: boolean
  /** Верхний ярус: ручка снизу, а не сверху. */
  upper?: boolean
}

export interface RenderMaterial {
  /** Линейное пространство, 0..1. */
  albedo: [number, number, number]
  roughness: number
  metallic: number
  pattern: PatternKind
  /** Масштаб рисунка, м. */
  scale: number
  panel?: PanelLayout
  emission?: [number, number, number]
}

export interface RenderBox {
  min: [number, number, number]
  max: [number, number, number]
  material: number
  /** Оболочка помещения: камера внутри, нормали направлены внутрь. */
  inverted?: boolean
  /**
   * Невидим для первичных лучей, но продолжает отбрасывать тень, отражаться
   * и давать переотражённый свет. Так комната участвует в расчёте, оставаясь
   * на итоговом кадре настоящей фотографией.
   */
  hidden?: boolean
  /** Плоскость, принимающая тень от кухни на реальный пол. */
  shadowCatcher?: boolean
}

/** Прямоугольный источник света. */
export interface AreaLight {
  origin: [number, number, number]
  u: [number, number, number]
  v: [number, number, number]
  normal: [number, number, number]
  color: [number, number, number]
  intensity: number
  samples: number
}

export interface Camera {
  position: [number, number, number]
  target: [number, number, number]
  /** Вертикальный угол обзора, градусы. */
  fov: number
}

export interface SceneSpec {
  /** Кухня вписывается в фотографию: комната не рисуется. */
  compositing?: boolean
  /** Раскладка модулей в миллиметрах — из неё строятся чертежи. */
  layout?: import('../drawings/types.ts').KitchenLayout
  boxes: RenderBox[]
  materials: RenderMaterial[]
  lights: AreaLight[]
  camera: Camera
  ambient: [number, number, number]
  exposure: number
  /** Сила светотеневого рисунка, 0..1. */
  contrast: number
  /** Зерно плёнки, 0..1. */
  grain: number
  seed: number
}
