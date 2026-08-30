/** Тип рисунка поверхности — используется для локальных CSS/SVG-превью. */
export type GrainKind =
  | 'flat'
  | 'wood'
  | 'veneer'
  | 'stone'
  | 'marble'
  | 'linear'
  | 'gloss'
  | 'speck'

/** Описание визуального превью поверхности. Никаких внешних изображений. */
export interface SurfacePreview {
  /** Основной тон поверхности. */
  base: string
  /** Светлая составляющая (блик, прожилка). */
  highlight: string
  /** Тёмная составляющая (тень, волокно). */
  shade: string
  grain: GrainKind
}

export interface CatalogEntity {
  id: string
  name: string
  description: string
}

/** Материал фасада. */
export interface Material extends CatalogEntity {
  /** Короткая подпись под названием: «Матовый», «Натуральное волокно». */
  caption: string
  preview: SurfacePreview
}

/** Цвет фасада. */
export interface ColorOption extends CatalogEntity {
  hex: string
  grain: GrainKind
  /** Тон для контроля контраста подписи поверх образца. */
  tone: 'light' | 'dark'
}

/** Фактура поверхности. */
export interface Texture extends CatalogEntity {
  /** Насколько поверхность блестит: 0 — глубокий мат, 1 — зеркальный глянец. */
  gloss: number
  grain: GrainKind
}

/** Материал столешницы. */
export interface CountertopMaterial extends CatalogEntity {
  caption: string
  preview: SurfacePreview
}

/** Цвет столешницы. */
export interface CountertopColor extends CatalogEntity {
  hex: string
  grain: GrainKind
  tone: 'light' | 'dark'
}

export interface CountertopCatalog {
  materials: CountertopMaterial[]
  colors: CountertopColor[]
}

/** Готовая цветовая палитра интерьера. */
export interface PaletteSwatch {
  name: string
  hex: string
}

export interface Palette extends CatalogEntity {
  swatches: PaletteSwatch[]
}

/** Стиль интерьера. */
export interface Style extends CatalogEntity {
  /** Цвета для миниатюрной сцены на карточке. */
  preview: {
    wall: string
    facade: string
    counter: string
    accent: string
  }
  /** Особенности стиля, влияющие на демонстрационную сцену. */
  traits: {
    /** Открытые полки вместо части верхних шкафов. */
    openShelves: boolean
    /** Ручки: скрытые, накладные рейлинги или классические. */
    handles: 'hidden' | 'bar' | 'knob'
    /** Филёнка на фасадах. */
    framedDoors: boolean
  }
}

/** Схема освещения. */
export interface Lighting extends CatalogEntity {
  /** Цветовая температура, К. Показывается второстепенно. */
  kelvin: number
  /** 0 — холодный, 1 — тёплый. */
  warmth: number
  /** Сила светотеневого рисунка: 0 — плоский свет, 1 — драматичный. */
  contrast: number
  /** Общая яркость сцены. */
  brightness: number
}

/** Дополнительный параметр-переключатель. */
export interface ProjectOption extends CatalogEntity {
  /** Включён ли по умолчанию. */
  defaultValue: boolean
  group: 'preserve' | 'add'
}

export interface Catalog {
  materials: Material[]
  colors: ColorOption[]
  textures: Texture[]
  palettes: Palette[]
  styles: Style[]
  countertops: CountertopCatalog
  lighting: Lighting[]
  options: ProjectOption[]
}
