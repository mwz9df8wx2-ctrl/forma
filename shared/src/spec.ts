import * as z from 'zod'

/**
 * ProjectSpec — единственный источник правды о проекте.
 *
 * Из него строятся визуализация, чертежи, смета и техпакет. Картинка,
 * полученная от ИИ, источником размеров быть не может: она лишь показывает
 * клиенту, как будет выглядеть то, что уже описано здесь.
 *
 * Все производственные размеры — целые миллиметры.
 */

/** Откуда взялось значение. Нужно, чтобы отличать замер от предположения. */
export const valueStatusSchema = z.enum(['confirmed', 'derived', 'estimated', 'missing'])
export type ValueStatus = z.infer<typeof valueStatusSchema>

/** Кто ввёл данные. */
export const valueSourceSchema = z.enum(['manual', 'chat', 'ocr', 'vision', 'default'])
export type ValueSource = z.infer<typeof valueSourceSchema>

const millimetres = z.int().min(0).max(20000)

export const dimensionsSchema = z.object({
  /** Длина стены с основным фронтом кухни. */
  roomWidth: millimetres,
  /** Глубина помещения от стены с кухней. */
  roomDepth: millimetres,
  roomHeight: millimetres,
  counterHeight: millimetres,
  counterDepth: millimetres,
  /** Длина боковой стены с кухней. 0 — прямая кухня. */
  sideRun: millimetres,
})
export type Dimensions = z.infer<typeof dimensionsSchema>

export const layoutKindSchema = z.enum(['straight', 'corner'])
export type LayoutKind = z.infer<typeof layoutKindSchema>

export const furnitureCategorySchema = z.enum([
  'kitchen',
  'wardrobe',
  'cabinet',
  'tv_zone',
  'hallway',
  'bathroom',
  'shelving',
  'custom',
])
export type FurnitureCategory = z.infer<typeof furnitureCategorySchema>

/** Выбор из каталога компании. Идентификаторы принадлежат каталогу, не ИИ. */
export const materialsSchema = z.object({
  materialId: z.string().nullable(),
  colorId: z.string().nullable(),
  textureId: z.string().nullable(),
  paletteId: z.string().nullable(),
  styleId: z.string().nullable(),
  countertopMaterialId: z.string().nullable(),
  countertopColorId: z.string().nullable(),
  lightingId: z.string().nullable(),
})
export type Materials = z.infer<typeof materialsSchema>

/** Техника: размер важен для геометрии, модель — для точных вырезов. */
export const applianceSchema = z.object({
  slot: z.enum(['hob', 'oven', 'dishwasher', 'fridge', 'microwave', 'hood', 'sink']),
  widthMm: millimetres,
  /** Марка и модель, если известны. Без них вырезы остаются предварительными. */
  model: z.string().nullable(),
  installation: z.enum(['built_in', 'freestanding', 'countertop']),
  status: valueStatusSchema,
})
export type Appliance = z.infer<typeof applianceSchema>

/** Точка подключения: вода, канализация, розетка, вентиляция. */
export const utilitySchema = z.object({
  kind: z.enum(['cold_water', 'hot_water', 'drain', 'socket', 'switch', 'ventilation', 'gas']),
  /** Стена: основная или боковая. */
  wall: z.enum(['main', 'side']),
  /** Расстояние от угла до центра точки. */
  offsetMm: millimetres,
  heightMm: millimetres,
  status: valueStatusSchema,
})
export type Utility = z.infer<typeof utilitySchema>

export const projectSpecSchema = z.object({
  /** Версия схемы: ревизии старых проектов должны читаться и через год. */
  version: z.literal(1),
  category: furnitureCategorySchema,
  layoutKind: layoutKindSchema,
  dimensions: dimensionsSchema,
  /** Статус каждого размера: замер, расчёт или предположение. */
  dimensionStatus: z.record(z.string(), valueStatusSchema).default({}),
  materials: materialsSchema,
  options: z.record(z.string(), z.boolean()).default({}),
  appliances: z.array(applianceSchema).default([]),
  utilities: z.array(utilitySchema).default([]),
  /** Свободные пожелания клиента — для контекста, не для расчётов. */
  notes: z.string().default(''),
})
export type ProjectSpec = z.infer<typeof projectSpecSchema>

export const PROJECT_STATUSES = [
  'draft',
  'measurement',
  'requirements_parsed',
  'requirements_confirmed',
  'ready_for_visualization',
  'visualization_queued',
  'visualization_running',
  'visualization_ready',
  'client_approved',
  'technical_package_generating',
  'technical_package_ready',
  'sent_to_constructor',
  'completed',
  'archived',
] as const

export const projectStatusSchema = z.enum(PROJECT_STATUSES)
export type ProjectStatus = z.infer<typeof projectStatusSchema>

/** Пустая спецификация: используется при создании проекта. */
export function emptySpec(category: FurnitureCategory = 'kitchen'): ProjectSpec {
  return {
    version: 1,
    category,
    layoutKind: 'straight',
    dimensions: {
      roomWidth: 0,
      roomDepth: 0,
      roomHeight: 0,
      counterHeight: 900,
      counterDepth: 600,
      sideRun: 0,
    },
    dimensionStatus: {
      roomWidth: 'missing',
      roomDepth: 'missing',
      roomHeight: 'missing',
      counterHeight: 'derived',
      counterDepth: 'derived',
      sideRun: 'missing',
    },
    materials: {
      materialId: null,
      colorId: null,
      textureId: null,
      paletteId: null,
      styleId: null,
      countertopMaterialId: null,
      countertopColorId: null,
      lightingId: null,
    },
    options: {},
    appliances: [],
    utilities: [],
    notes: '',
  }
}

/** Готова ли спецификация к визуализации. */
export function specReadiness(spec: ProjectSpec): { ready: boolean; missing: string[] } {
  const missing: string[] = []
  if (spec.dimensions.roomWidth <= 0) missing.push('длина стены с кухней')
  if (spec.dimensions.roomHeight <= 0) missing.push('высота помещения')
  if (spec.layoutKind === 'corner' && spec.dimensions.sideRun <= 0) {
    missing.push('длина боковой стены')
  }
  if (!spec.materials.materialId) missing.push('материал фасадов')
  if (!spec.materials.colorId) missing.push('цвет фасадов')
  return { ready: missing.length === 0, missing }
}
