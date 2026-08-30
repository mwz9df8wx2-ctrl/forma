import type { Catalog, Dimensions, GenerationStage, ProjectParams } from '@/types'
import { MOCK_MATERIALS } from './materials.ts'
import { MOCK_COLORS } from './colors.ts'
import { MOCK_TEXTURES } from './textures.ts'
import { MOCK_PALETTES } from './palettes.ts'
import { MOCK_STYLES } from './styles.ts'
import { MOCK_COUNTERTOPS } from './countertops.ts'
import { MOCK_LIGHTING } from './lighting.ts'
import { MOCK_OPTIONS } from './options.ts'

export const MOCK_CATALOG: Catalog = {
  materials: MOCK_MATERIALS,
  colors: MOCK_COLORS,
  textures: MOCK_TEXTURES,
  palettes: MOCK_PALETTES,
  styles: MOCK_STYLES,
  countertops: MOCK_COUNTERTOPS,
  lighting: MOCK_LIGHTING,
  options: MOCK_OPTIONS,
}

/** Типовые размеры городской кухни — чтобы поля не были пустыми. */
export const DEFAULT_DIMENSIONS: Dimensions = {
  roomWidth: 2700,
  roomDepth: 3200,
  roomHeight: 2700,
  counterHeight: 900,
  counterDepth: 600,
  sideRun: 1900,
}

export const DIMENSION_LIMITS: Record<keyof Dimensions, { min: number; max: number; label: string; hint: string }> = {
  roomWidth: { min: 1000, max: 12000, label: 'Стена с кухней', hint: 'основной фронт, мм' },
  sideRun: { min: 0, max: 6000, label: 'Боковая стена', hint: 'для угловой кухни, мм' },
  roomDepth: { min: 1500, max: 12000, label: 'Глубина помещения', hint: 'от 1500 до 12 000 мм' },
  roomHeight: { min: 2000, max: 5000, label: 'Высота помещения', hint: 'от 2000 до 5000 мм' },
  counterHeight: { min: 700, max: 1100, label: 'Высота столешницы', hint: 'от 700 до 1100 мм' },
  counterDepth: { min: 400, max: 900, label: 'Глубина столешницы', hint: 'от 400 до 900 мм' },
}

export const DEFAULT_OPTION_VALUES = Object.fromEntries(
  MOCK_OPTIONS.map((option) => [option.id, option.defaultValue]),
)

/**
 * Стартовый набор параметров. Материал и цвет фасада мебельщик выбирает сам —
 * это ключевое решение проекта, поэтому предзаполнения у них нет.
 */
export const DEFAULT_PARAMS: ProjectParams = {
  category: 'kitchen',
  layoutKind: 'corner',
  dimensions: { ...DEFAULT_DIMENSIONS },
  materialId: null,
  colorId: null,
  textureId: 'matte',
  paletteId: 'warm-minimal',
  styleId: 'modern-minimal',
  countertopMaterialId: 'quartz',
  countertopColorId: 'top-white',
  lightingId: 'natural',
  options: { ...DEFAULT_OPTION_VALUES },
}

/** Обязательные параметры: без них кнопка генерации недоступна. */
export const REQUIRED_PARAMS: Array<{ key: keyof ProjectParams; label: string }> = [
  { key: 'materialId', label: 'материал фасадов' },
  { key: 'colorId', label: 'цвет' },
  { key: 'countertopMaterialId', label: 'материал столешницы' },
  { key: 'styleId', label: 'стиль' },
  { key: 'lightingId', label: 'освещение' },
]

/** Этапы, которые видит пользователь. Технических терминов здесь быть не должно. */
export const GENERATION_STAGES: GenerationStage[] = [
  { id: 'analyze', label: 'Анализируем фотографию' },
  { id: 'materials', label: 'Сохраняем геометрию помещения' },
  { id: 'interior', label: 'Создаём кухню' },
  { id: 'render', label: 'Финализируем изображение' },
]

/** Что именно собирается на третьем шаге — зависит от категории. */
const OBJECT_STAGE_LABEL: Record<string, string> = {
  kitchen: 'Создаём кухню',
  wardrobe: 'Собираем шкаф',
  cabinet: 'Собираем тумбу',
  tv_zone: 'Собираем ТВ-зону',
  living_room: 'Собираем стенку',
}

/**
 * Этапы под категорию проекта. Подписи обязаны совпадать с тем, что
 * действительно происходит: «создаём кухню» при сборке шкафа — мелкая ложь,
 * из-за которой перестают верить и остальному.
 */
export function generationStages(category: string): GenerationStage[] {
  return GENERATION_STAGES.map((stage) =>
    stage.id === 'interior'
      ? { ...stage, label: OBJECT_STAGE_LABEL[category] ?? stage.label }
      : stage,
  )
}
