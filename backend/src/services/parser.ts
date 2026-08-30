import { env } from '../env.ts'
import {
  measurementChecklist,
  parseMeasurements,
  type MeasurementSuggestion,
  type ProjectSpec,
} from '../../../shared/src/index.ts'

/**
 * Разбор текста замера моделью.
 *
 * Модель здесь ничего не считает. Ей запрещено выводить размер из других
 * размеров, оценивать по фотографии и дополнять недостающее «типовым»
 * значением: производственные размеры выводятся только из замера. Её работа —
 * разложить по полям то, что человек уже написал словами.
 *
 * Поверх модели всегда работает детерминированный разбор. При расхождении
 * побеждает он: его результат можно проверить глазами по цитате.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5'

const INSTRUCTION = `Ты разбираешь текст замерщика мебели на русском языке.

Извлеки ТОЛЬКО те числа, которые человек назвал явно. Правила:
- Никогда не вычисляй один размер из другого.
- Никогда не подставляй типовые значения, если размера в тексте нет.
- Если величина названа без единицы измерения, считай целые числа миллиметрами,
  а дробные — метрами.
- Для каждого значения приведи фрагмент исходного текста, из которого оно взято.
- Если значения нет — не включай поле в ответ.

Доступные поля и их смысл:
roomWidth — длина стены с кухней; sideRun — длина боковой стены;
roomHeight — высота помещения; roomDepth — глубина помещения;
counterHeight — высота столешницы от пола; counterDepth — глубина столешницы;
appliance:fridge, appliance:hob, appliance:sink, appliance:oven,
appliance:dishwasher, appliance:hood, appliance:microwave — ширина техники;
utility:cold_water, utility:drain — расстояние от угла до точки подключения.`

interface ToolResult {
  measurements?: { id: string; value: number; quote: string }[]
}

async function askModel(text: string): Promise<MeasurementSuggestion[]> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: INSTRUCTION,
      tool_choice: { type: 'tool', name: 'record_measurements' },
      tools: [
        {
          name: 'record_measurements',
          description: 'Записать найденные в тексте замеры',
          input_schema: {
            type: 'object',
            properties: {
              measurements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    value: { type: 'number', description: 'Значение в миллиметрах' },
                    quote: { type: 'string', description: 'Фрагмент исходного текста' },
                  },
                  required: ['id', 'value', 'quote'],
                },
              },
            },
            required: ['measurements'],
          },
        },
      ],
      messages: [{ role: 'user', content: text }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Провайдер разбора ответил ${response.status}`)
  }

  const payload = (await response.json()) as {
    content?: { type: string; name?: string; input?: ToolResult }[]
  }
  const block = payload.content?.find((item) => item.type === 'tool_use')
  const measurements = block?.input?.measurements ?? []

  return measurements
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .map((item) => ({
      id: item.id,
      value: Math.round(item.value),
      confidence: 'medium' as const,
      quote: String(item.quote ?? '').slice(0, 200),
    }))
}

export interface ParseOutcome {
  suggestions: MeasurementSuggestion[]
  /** Участвовала ли модель. Влияет на списание кредита. */
  usedModel: boolean
}

/**
 * Разбор текста. Правила работают всегда, модель — если она настроена
 * и её попросили. Отказ модели не ломает разбор: правила уже дали результат.
 */
export async function parseText(
  spec: ProjectSpec,
  text: string,
  useModel: boolean,
): Promise<ParseOutcome> {
  const checklist = measurementChecklist(spec)
  const byRules = parseMeasurements(text, checklist)

  if (!useModel || !env.anthropicKey || !env.aiEnabled) {
    return { suggestions: byRules, usedModel: false }
  }

  let fromModel: MeasurementSuggestion[] = []
  try {
    fromModel = await askModel(text)
  } catch {
    // Модель недоступна — отдаём то, что нашли правила, и не берём кредит.
    return { suggestions: byRules, usedModel: false }
  }

  const limits = new Map(checklist.map((item) => [item.id, item]))
  const merged = new Map(byRules.map((item) => [item.id, item]))

  for (const item of fromModel) {
    // Правила уже нашли это поле — их результат проверяем по цитате, он надёжнее.
    if (merged.has(item.id)) continue
    const limit = limits.get(item.id)
    if (!limit) continue
    if (item.value < limit.min || item.value > limit.max) continue
    merged.set(item.id, item)
  }

  return { suggestions: [...merged.values()], usedModel: true }
}
