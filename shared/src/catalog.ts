import * as z from 'zod'

/**
 * Каталог компании.
 *
 * Приложение не имеет права предлагать клиенту то, что цех не может
 * изготовить. Поэтому материалы, столешницы, фурнитура и техника — это записи
 * каталога конкретной компании, а не выдумка модели.
 *
 * Хранятся в одной таблице с типом-дискриминатором: логически сущности
 * разделены схемами, физически — не размазаны по десятку таблиц.
 */

export const catalogTypeSchema = z.enum([
  'facade',
  'countertop',
  'carcass',
  'hardware',
  'appliance',
  'lighting',
])
export type CatalogType = z.infer<typeof catalogTypeSchema>

export const CATALOG_TYPE_LABELS: Record<CatalogType, string> = {
  facade: 'Фасады',
  countertop: 'Столешницы',
  carcass: 'Корпусные материалы',
  hardware: 'Фурнитура',
  appliance: 'Техника',
  lighting: 'Освещение',
}

const money = z.number().min(0).max(10_000_000).nullable()
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ожидается цвет в формате #RRGGBB')

/** Фасад: то, что клиент видит и выбирает в первую очередь. */
export const facadeAttributesSchema = z.object({
  brand: z.string().max(120).default(''),
  collection: z.string().max(120).default(''),
  material: z.enum(['mdf', 'enamel', 'solid_wood', 'veneer', 'chipboard', 'acrylic', 'plastic']),
  colorName: z.string().max(120),
  colorHex: hex,
  finish: z.enum(['matte', 'satin', 'gloss', 'wood', 'stone', 'textured']),
  thicknessMm: z.int().min(8).max(40).default(19),
  /** Ручки: у безручечных фасадов другая присадка и другой расчёт. */
  handleless: z.boolean().default(false),
})

/** Столешница: визуальная и фактическая толщина различаются. */
export const countertopAttributesSchema = z.object({
  brand: z.string().max(120).default(''),
  collection: z.string().max(120).default(''),
  material: z.enum(['quartz', 'stone', 'hpl', 'wood', 'porcelain', 'chipboard']),
  decor: z.string().max(120),
  colorHex: hex,
  /** Реальная толщина плиты. */
  actualThicknessMm: z.int().min(8).max(120).default(38),
  /** Видимая толщина торца: у камня она часто наборная. */
  visualThicknessMm: z.int().min(8).max(200).default(38),
  edgeProfile: z.string().max(80).default('R3'),
})

export const carcassAttributesSchema = z.object({
  brand: z.string().max(120).default(''),
  decor: z.string().max(120),
  material: z.enum(['chipboard', 'mdf', 'plywood']),
  thicknessMm: z.int().min(8).max(40).default(16),
  backPanelThicknessMm: z.int().min(2).max(20).default(4),
  visibleEdgeMm: z.number().min(0).max(3).default(1),
  hiddenEdgeMm: z.number().min(0).max(3).default(0.4),
})

export const hardwareAttributesSchema = z.object({
  brand: z.string().max(120).default(''),
  kind: z.enum(['hinge', 'slide', 'leg', 'bracket', 'bolt', 'confirmat', 'screw', 'handle']),
  /** Размер или артикул: «110°», «500 мм», «7×50». */
  size: z.string().max(80).default(''),
  unit: z.enum(['шт', 'пара', 'компл.']).default('шт'),
})

export const applianceAttributesSchema = z.object({
  brand: z.string().max(120).default(''),
  model: z.string().max(120).default(''),
  kind: z.enum(['hob', 'oven', 'dishwasher', 'fridge', 'microwave', 'hood', 'sink']),
  widthMm: z.int().min(100).max(1200),
  heightMm: z.int().min(0).max(2400).default(0),
  depthMm: z.int().min(0).max(1000).default(0),
  installation: z.enum(['built_in', 'freestanding', 'countertop']).default('built_in'),
  /** Размер выреза известен только для подтверждённой модели. */
  cutoutWidthMm: z.int().min(0).max(2000).default(0),
  cutoutDepthMm: z.int().min(0).max(1000).default(0),
})

export const lightingAttributesSchema = z.object({
  brand: z.string().max(120).default(''),
  kind: z.enum(['led_strip', 'spot', 'pendant', 'in_cabinet']),
  colorTemperatureK: z.int().min(1800).max(8000).default(3000),
  powerPerMetreW: z.number().min(0).max(100).default(0),
})

export const catalogAttributesByType = {
  facade: facadeAttributesSchema,
  countertop: countertopAttributesSchema,
  carcass: carcassAttributesSchema,
  hardware: hardwareAttributesSchema,
  appliance: applianceAttributesSchema,
  lighting: lightingAttributesSchema,
} as const

export const catalogItemInputSchema = z.object({
  type: catalogTypeSchema,
  sku: z.string().max(80).default(''),
  name: z.string().min(1).max(200),
  purchasePrice: money.default(null),
  salePrice: money.default(null),
  active: z.boolean().default(true),
  /** Демонстрационная запись: её видно, но она не выдаётся за реальную. */
  demo: z.boolean().default(false),
  attributes: z.unknown(),
})
export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>

export interface CatalogItem extends Omit<CatalogItemInput, 'attributes'> {
  id: string
  companyId: string
  attributes: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** Проверка атрибутов по типу записи. Неизвестный тип не пройдёт. */
export function parseCatalogAttributes(type: CatalogType, attributes: unknown): Record<string, unknown> {
  const schema = catalogAttributesByType[type]
  return schema.parse(attributes) as Record<string, unknown>
}

/**
 * Производственный профиль: значения по умолчанию для расчётов.
 * Проект может их переопределить, но начинать нужно с настроек цеха.
 */
export const productionProfileSchema = z.object({
  carcassThicknessMm: z.int().min(8).max(40).default(16),
  facadeThicknessMm: z.int().min(8).max(40).default(19),
  backPanelThicknessMm: z.int().min(2).max(20).default(4),
  facadeGapMm: z.number().min(0).max(10).default(2),
  plinthHeightMm: z.int().min(0).max(300).default(100),
  baseDepthMm: z.int().min(200).max(900).default(560),
  upperDepthMm: z.int().min(150).max(700).default(320),
  worktopDepthMm: z.int().min(300).max(1200).default(600),
  worktopHeightMm: z.int().min(700).max(1100).default(900),
  visibleEdgeMm: z.number().min(0).max(3).default(1),
  hiddenEdgeMm: z.number().min(0).max(3).default(0.4),
  defaultHardwareBrand: z.string().max(80).default('Boyard'),
})
export type ProductionProfile = z.infer<typeof productionProfileSchema>

export function defaultProductionProfile(): ProductionProfile {
  return productionProfileSchema.parse({})
}
