import * as z from 'zod'

/**
 * Смета.
 *
 * Считается из ProjectSpec и раскроя — без участия модели. Цены берутся из
 * каталога компании на сервере и сохраняются снимком: через полгода должно
 * быть видно, из чего сложилась сумма, даже если материал с тех пор подорожал.
 *
 * Все суммы — целые копейки.
 */

export const PRICE_UNITS = ['piece', 'square_metre', 'linear_metre', 'sheet'] as const
export const priceUnitSchema = z.enum(PRICE_UNITS)
export type PriceUnit = (typeof PRICE_UNITS)[number]

export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  piece: 'шт',
  square_metre: 'м²',
  linear_metre: 'м. п.',
  sheet: 'лист',
}

export const ESTIMATE_SECTIONS = ['facade', 'countertop', 'carcass', 'hardware', 'work'] as const
export const estimateSectionSchema = z.enum(ESTIMATE_SECTIONS)
export type EstimateSection = (typeof ESTIMATE_SECTIONS)[number]

export const ESTIMATE_SECTION_LABELS: Record<EstimateSection, string> = {
  facade: 'Фасады',
  countertop: 'Столешница',
  carcass: 'Корпус',
  hardware: 'Фурнитура и крепёж',
  work: 'Работы',
}

/**
 * Позиция, которую фронтенд просит посчитать.
 * Количество — из раскроя, цену подставляет сервер: цена, пришедшая из
 * браузера, — это не цена, а пожелание.
 */
export const estimateRequestLineSchema = z.object({
  section: estimateSectionSchema,
  /** Запись каталога компании. Если её нет — позиция считается без цены. */
  catalogItemId: z.string().nullable(),
  name: z.string().min(1).max(200),
  unit: priceUnitSchema,
  /** Количество в тысячных долях единицы: 2.5 м² — это 2500. */
  quantityMilli: z.int().min(0).max(100_000_000),
  note: z.string().max(200).default(''),
})
export type EstimateRequestLine = z.infer<typeof estimateRequestLineSchema>

export const estimateLineSchema = estimateRequestLineSchema.extend({
  /** Цена за единицу на момент расчёта, копейки. */
  unitPriceKopecks: z.int(),
  /** Итог по строке, копейки. */
  totalKopecks: z.int(),
  /** Цены в каталоге нет — позицию нужно заполнить руками. */
  priceMissing: z.boolean(),
})
export type EstimateLine = z.infer<typeof estimateLineSchema>

export const estimateTotalsSchema = z.object({
  bySection: z.record(z.string(), z.int()),
  materialsKopecks: z.int(),
  markupKopecks: z.int(),
  totalKopecks: z.int(),
  /** Сколько позиций осталось без цены: сумма неполная, пока их больше нуля. */
  missingPrices: z.int(),
})
export type EstimateTotals = z.infer<typeof estimateTotalsSchema>

export const estimateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  revisionId: z.string(),
  markupPercent: z.int(),
  lines: z.array(estimateLineSchema),
  totals: estimateTotalsSchema,
  createdAt: z.string(),
})
export type Estimate = z.infer<typeof estimateSchema>

/** Количество в тысячных → умножение на цену без потери копеек. */
export function lineTotalKopecks(quantityMilli: number, unitPriceKopecks: number): number {
  return Math.round((quantityMilli * unitPriceKopecks) / 1000)
}

export function summariseEstimate(lines: EstimateLine[], markupPercent: number): EstimateTotals {
  const bySection: Record<string, number> = {}
  let materials = 0
  let missing = 0

  for (const line of lines) {
    bySection[line.section] = (bySection[line.section] ?? 0) + line.totalKopecks
    materials += line.totalKopecks
    if (line.priceMissing) missing += 1
  }

  const markup = Math.round((materials * markupPercent) / 100)
  return {
    bySection,
    materialsKopecks: materials,
    markupKopecks: markup,
    totalKopecks: materials + markup,
    missingPrices: missing,
  }
}

/** Копейки в читаемые рубли. Округление вниз до копейки, без плавающей точки. */
export function formatRubles(kopecks: number): string {
  const sign = kopecks < 0 ? '−' : ''
  const absolute = Math.abs(kopecks)
  const rubles = Math.trunc(absolute / 100)
  const rest = absolute % 100
  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}${grouped},${String(rest).padStart(2, '0')} ₽`
}

export function formatQuantity(quantityMilli: number, unit: PriceUnit): string {
  const value = quantityMilli / 1000
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return `${text} ${PRICE_UNIT_LABELS[unit]}`
}
