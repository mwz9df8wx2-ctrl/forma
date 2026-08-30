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
  layout?: import('../drawings/types.ts').FurnitureLayout
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

/** Исходные данные сцены — уже разрешённые значения, без справочников. */
export interface SceneInput {
  /** Что строим. От категории зависит вся геометрия сцены. */
  category?:
    | 'kitchen'
    | 'wardrobe'
    | 'cabinet'
    | 'tv_zone'
    | 'living_room'
    | 'hallway'
    | 'bathroom'
    | 'shelving'
  room: { width: number; height: number; depth: number }
  counter: { height: number; depth: number }
  /**
   * Длина фронта вдоль боковой стены, м. 0 — прямая кухня.
   * Отсчёт от задней стены, угол принадлежит основному фронту.
   */
  sideRun?: number
  facade: {
    color: string
    pattern: PatternKind
    roughness: number
    handles: 'hidden' | 'bar' | 'knob'
    frame: boolean
    /** Человеческое название материала и цвета — попадает в спецификацию. */
    label?: string
  }
  countertop: { color: string; pattern: PatternKind; roughness: number }
  wall: string
  floor: string
  accent: string
  light: { warmth: number; brightness: number; contrast: number }
  options: {
    island: boolean
    appliances: boolean
    /** Вытяжка рисуется только по явному запросу. */
    hood: boolean
    ledLight: boolean
    windows: boolean
    openShelves: boolean
  }
  variant: number
  seed: number
  /**
   * Вписывание в фотографию: стены, пол, потолок и окно не рисуются,
   * но продолжают освещать сцену и принимать тень.
   */
  compositing?: boolean
  /** Камера, рассчитанная по фотографии. */
  camera?: {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
  }
  /** Цвета реальных поверхностей — для корректного переотражённого света. */
  surfaces?: { wall: string; floor: string; ceiling: string }
  /**
   * Окно в координатах сцены. Задаётся, когда положение окна взято
   * с фотографии: свет должен приходить оттуда же, откуда на снимке.
   * null — окна в кадре нет.
   */
  windowRect?: { x0: number; y0: number; x1: number; y1: number } | null
  /**
   * preview — меньше выборок света: расчёт в браузере должен укладываться
   * в несколько секунд. high — качество для изображений, отрисованных заранее.
   */
  quality?: 'preview' | 'high'
}
