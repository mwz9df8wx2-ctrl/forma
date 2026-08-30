/** Прямоугольная область в нормированных координатах 0..1. */
export interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface DetectedWindow extends Region {
  /** Насколько уверенно область похожа на окно, 0..1. */
  strength: number
}

/** Что удалось понять по фотографии помещения. */
export interface PhotoAnalysis {
  /** Размер рабочего буфера, на котором считался анализ. */
  width: number
  height: number

  /** Линия горизонта (уровень глаз камеры), 0..1 по высоте кадра. */
  horizonY: number
  /** Точка схода перспективы, если найдена. */
  vanishing: { x: number; y: number } | null
  /** Оценка горизонтального угла обзора, радианы. */
  fovHorizontal: number

  /** Стык пола и дальней стены. */
  floorLineY: number | null
  /** Стык потолка и дальней стены. */
  ceilingLineY: number | null
  /** Сильная горизонтальная линия в средней зоне — обычно столешница. */
  counterLineY: number | null
  /** Границы дальней стены по горизонтали, если видны углы. */
  wallSpan: { left: number; right: number } | null
  /**
   * Горизонтальные границы столешницы. Это самое надёжное измерение кадра:
   * длинная контрастная кромка с чёткими концами.
   */
  counterSpan: { left: number; right: number } | null

  windows: DetectedWindow[]

  light: {
    /** -1 свет слева, 0 фронтально, 1 справа. */
    directionX: number
    /** 0 холодный, 1 тёплый. */
    warmth: number
    brightness: number
    contrast: number
  }

  colors: {
    wall: string
    floor: string
    ceiling: string
  }

  /** Полоса кадра, в которой находится существующая кухня. */
  kitchenBand: { top: number; bottom: number } | null

  /** Наклон длинной горизонтальной кромки, градусы. Признак ракурса. */
  edgeTilt: number | null

  /**
   * Годится ли снимок для вписывания кухни.
   * Плохо совмещённый кадр хуже честного отдельного рендера, поэтому при
   * неподходящем ракурсе вписывание не запускается.
   */
  suitability: {
    composable: boolean
    reason: string | null
  }

  /** Насколько можно доверять оценке перспективы, 0..1. */
  confidence: number
}
