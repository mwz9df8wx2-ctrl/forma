/** Тип модуля кухни. */
export type ModuleKind = 'base' | 'upper' | 'tall' | 'island' | 'shelf' | 'appliance'

/**
 * Модуль кухни в миллиметрах.
 * Начало координат — левый край помещения и уровень пола.
 */
export interface KitchenModule {
  id: string
  kind: ModuleKind
  label: string
  /** Отступ от левого края помещения, мм. */
  x: number
  width: number
  /** Высота нижней кромки от пола, мм. */
  y: number
  height: number
  depth: number
  /** Число дверец или ящиков в модуле. */
  doors: number
  /** Материал и цвет фасада — для спецификации. */
  facade?: string
}

export interface KitchenLayout {
  room: { width: number; height: number; depth: number }
  counter: { height: number; depth: number; thickness: number }
  /** Границы фронта кухни вдоль стены, мм. */
  run: { start: number; end: number }
  backsplash: { top: number }
  /** Оконный проём на дальней стене, если он есть. */
  window: { x: number; width: number; y: number; height: number } | null
  modules: KitchenModule[]
}
