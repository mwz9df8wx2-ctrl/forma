import type { MeasurementItem } from './measurements.ts'

/**
 * Разбор текста замера в числа.
 *
 * Правило, ради которого это написано вручную, а не отдано модели: разбор
 * никогда не придумывает значение. Он находит число, которое человек написал,
 * и показывает фрагмент, из которого оно взято. Проверить строку глазами
 * замерщик может за секунду — а вычислять размеры за него нельзя, ошибка
 * в 30–50 мм превращает столешницу в брак.
 *
 * Модель подключается поверх этого разбора и тоже ничего не считает:
 * она только раскладывает текст по тем же полям.
 */

export type SuggestionConfidence = 'high' | 'medium'

export interface MeasurementSuggestion {
  /** Совпадает с id из листа замеров. */
  id: string
  value: number
  confidence: SuggestionConfidence
  /** Фрагмент исходного текста. Пользователь сверяет по нему, а не верит на слово. */
  quote: string
}

interface Rule {
  id: string
  /** Слова, по которым узнаём величину. Проверяются по началу слова. */
  keywords: string[]
  confidence: SuggestionConfidence
}

const RULES: Rule[] = [
  { id: 'roomWidth', keywords: ['задняя стена', 'основная стена', 'стена с кухней', 'длина кухни', 'фронт кухни', 'стена b'], confidence: 'high' },
  { id: 'sideRun', keywords: ['левая стена', 'боковая стена', 'вторая стена', 'стена a', 'угловая стена'], confidence: 'high' },
  { id: 'roomHeight', keywords: ['высота потолк', 'высота помещен', 'потолок', 'высота стен'], confidence: 'high' },
  { id: 'counterHeight', keywords: ['высота столешниц', 'высота рабочей', 'столешница от пола', 'от пола до столешниц'], confidence: 'high' },
  { id: 'counterDepth', keywords: ['глубина столешниц', 'глубина рабочей', 'ширина столешниц'], confidence: 'high' },
  { id: 'roomDepth', keywords: ['глубина помещен', 'глубина комнат', 'глубина кухни'], confidence: 'high' },
  { id: 'appliance:fridge', keywords: ['холодильник'], confidence: 'high' },
  { id: 'appliance:hob', keywords: ['варочн', 'варочная панель', 'плита'], confidence: 'high' },
  { id: 'appliance:sink', keywords: ['мойк', 'раковин'], confidence: 'high' },
  { id: 'appliance:oven', keywords: ['духов'], confidence: 'high' },
  { id: 'appliance:dishwasher', keywords: ['посудомо', 'пмм'], confidence: 'high' },
  { id: 'appliance:hood', keywords: ['вытяжк'], confidence: 'medium' },
  { id: 'appliance:microwave', keywords: ['микроволнов', 'свч'], confidence: 'medium' },
  { id: 'utility:cold_water', keywords: ['холодная вода', 'водоснабжен', 'смесител', 'вода'], confidence: 'medium' },
  { id: 'utility:drain', keywords: ['канализац', 'слив', 'стояк'], confidence: 'medium' },
]

/** Число с единицей измерения. Возвращает миллиметры. */
function readNumber(text: string): { value: number; raw: string } | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(мм|миллиметр\w*|см|сантиметр\w*|м(?![а-яё])|метр\w*)?/i)
  if (!match) return null

  const amount = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(amount)) return null

  const unit = (match[2] ?? '').toLowerCase()
  let millimetres: number
  if (unit.startsWith('см') || unit.startsWith('сантиметр')) {
    millimetres = amount * 10
  } else if (unit === 'м' || unit.startsWith('метр')) {
    millimetres = amount * 1000
  } else if (unit.startsWith('мм') || unit.startsWith('миллиметр')) {
    millimetres = amount
  } else {
    // Единица не названа. Дробное число — почти всегда метры («2,65»),
    // целое — миллиметры: так пишут в замерных листах.
    millimetres = match[1].includes(',') || match[1].includes('.') ? amount * 1000 : amount
  }

  return { value: Math.round(millimetres), raw: match[0].trim() }
}

/**
 * Разбор текста в предложения по листу замеров.
 * Значения вне разумного диапазона отбрасываются: опечатка на порядок
 * («холодильник 6000») не должна попасть в спецификацию.
 */
export function parseMeasurements(text: string, checklist: MeasurementItem[]): MeasurementSuggestion[] {
  const limits = new Map(checklist.map((item) => [item.id, item]))
  const found = new Map<string, MeasurementSuggestion>()

  // Запятая внутри числа — разделитель дробной части, а не конец фразы:
  // «2,65 м» не должно превратиться в «2» и «65 м».
  const guarded = text.replace(/(\d),(\d)/g, '$1.$2')

  // Разбиваем на короткие фразы: «холодильник 600, мойка 800» — это два замера.
  const clauses = guarded
    .split(/[,;\n•·]|\.(?!\d)|(?:\s-\s)/)
    .map((part) => part.trim())
    .filter(Boolean)

  for (const clause of clauses) {
    const lower = clause.toLowerCase().replace(/ё/g, 'е')

    for (const rule of RULES) {
      if (found.has(rule.id)) continue
      const keyword = rule.keywords.find((word) => lower.includes(word.replace(/ё/g, 'е')))
      if (!keyword) continue

      const number = readNumber(clause.slice(lower.indexOf(keyword) + keyword.length)) ?? readNumber(clause)
      if (!number) continue

      const limit = limits.get(rule.id)
      if (limit && (number.value < limit.min || number.value > limit.max)) continue

      found.set(rule.id, {
        id: rule.id,
        value: number.value,
        confidence: rule.confidence,
        quote: clause.length > 90 ? `${clause.slice(0, 87)}…` : clause,
      })
    }
  }

  return [...found.values()]
}
