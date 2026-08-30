import type { FurnitureCategory } from '@shared/index'

/** Подготовленная к отправке фотография помещения. */
export interface ProjectPhoto {
  /** Сжатое изображение в виде data URL — используется и для превью, и для отправки. */
  dataUrl: string
  width: number
  height: number
  /** Размер после сжатия, байты. */
  sizeBytes: number
  /** Исходный размер файла, байты. */
  originalSizeBytes: number
  fileName: string
  createdAt: string
}

/** Размеры помещения и рабочей зоны, мм. */
export interface Dimensions {
  /** Длина стены с основным фронтом кухни, мм. */
  roomWidth: number
  /** Глубина помещения от стены с кухней, мм. Нужна для плана. */
  roomDepth: number
  roomHeight: number
  counterHeight: number
  counterDepth: number
  /**
   * Длина боковой стены с кухней, мм. Для угловой планировки.
   * У прямой кухни не используется.
   */
  sideRun: number
}

export type OptionValues = Record<string, boolean>

/** Планировка фронта кухни. */
export type LayoutKind = 'straight' | 'corner'

/** Полный набор выбранных параметров будущей кухни. */
export interface ProjectParams {
  /** Что проектируем: от категории зависит раскладка и состав листов. */
  category: FurnitureCategory
  layoutKind: LayoutKind
  dimensions: Dimensions
  materialId: string | null
  colorId: string | null
  textureId: string | null
  paletteId: string | null
  styleId: string | null
  countertopMaterialId: string | null
  countertopColorId: string | null
  lightingId: string | null
  options: OptionValues
}

export interface Project {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  photo: ProjectPhoto | null
  params: ProjectParams
  /** Миниатюра последней визуализации для карточки проекта. */
  previewUrl: string | null
  /** Короткая сводка вида «Графит / дуб». */
  summary: string
  generationsCount: number
}

/** Карточка проекта в списке «Мои проекты» — без тяжёлых данных. */
export interface ProjectSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  photoThumbnail: string | null
  previewUrl: string | null
  summary: string
  generationsCount: number
}
