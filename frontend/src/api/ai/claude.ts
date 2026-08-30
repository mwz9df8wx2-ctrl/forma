import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as z from 'zod'
import { AppError } from '@/lib/errors'
import type { Catalog, ProjectPhoto } from '@/types'
import type { AiSettings } from './settings'

/**
 * Claude как аналитик снимка, а не генератор картинок.
 *
 * Модель смотрит на фотографию помещения и возвращает структурированный разбор:
 * что видно, что помешает монтажу и какой набор параметров каталога подойдёт
 * этой комнате. Изображения Claude не рисует — за визуализацию отвечает
 * офлайн-движок или сервис генерации.
 */

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5'

function createClient(settings: AiSettings): Anthropic {
  const apiKey = settings.claudeApiKey.trim()
  if (!apiKey) throw new AppError('unavailable')
  return new Anthropic({
    apiKey,
    // Ключ пользователя хранится на его устройстве; предупреждение об этом
    // выводится в интерфейсе настроек.
    dangerouslyAllowBrowser: true,
  })
}

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function splitDataUrl(dataUrl: string): { mediaType: MediaType; data: string } {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new AppError('photo_unsupported')
  return { mediaType: match[1] as MediaType, data: match[2] }
}

const nonEmpty = (values: string[]): [string, ...string[]] =>
  values.length > 0 ? (values as [string, ...string[]]) : ['—']

/** Схема ответа строится из каталога: модель обязана вернуть существующие id. */
function analysisSchema(catalog: Catalog) {
  return z.object({
    roomSummary: z.string(),
    condition: z.string(),
    observations: z.array(z.string()),
    risks: z.array(z.string()),
    recommendations: z.array(z.object({ title: z.string(), detail: z.string() })),
    suggestion: z.object({
      materialId: z.enum(nonEmpty(catalog.materials.map((item) => item.id))),
      colorId: z.enum(nonEmpty(catalog.colors.map((item) => item.id))),
      textureId: z.enum(nonEmpty(catalog.textures.map((item) => item.id))),
      paletteId: z.enum(nonEmpty(catalog.palettes.map((item) => item.id))),
      styleId: z.enum(nonEmpty(catalog.styles.map((item) => item.id))),
      countertopMaterialId: z.enum(nonEmpty(catalog.countertops.materials.map((item) => item.id))),
      countertopColorId: z.enum(nonEmpty(catalog.countertops.colors.map((item) => item.id))),
      lightingId: z.enum(nonEmpty(catalog.lighting.map((item) => item.id))),
      reason: z.string(),
    }),
  })
}

export type InteriorAnalysis = z.infer<ReturnType<typeof analysisSchema>>

function catalogBrief(catalog: Catalog): string {
  const list = (title: string, items: Array<{ id: string; name: string }>) =>
    `${title}: ${items.map((item) => `${item.id} (${item.name})`).join(', ')}`

  return [
    list('Материалы фасадов', catalog.materials),
    list('Цвета фасадов', catalog.colors),
    list('Фактуры', catalog.textures),
    list('Палитры', catalog.palettes),
    list('Стили', catalog.styles),
    list('Материалы столешниц', catalog.countertops.materials),
    list('Цвета столешниц', catalog.countertops.colors),
    list('Схемы освещения', catalog.lighting),
  ].join('\n')
}

const SYSTEM_PROMPT = `Ты — опытный кухонный дизайнер и замерщик. Тебе показывают фотографию помещения, снятую мебельщиком на замере.
Твоя задача — разобрать снимок и предложить подходящий набор параметров будущей кухни из заданного каталога.
Отвечай по-русски, коротко и по делу, как профессионал коллеге.
В observations опиши, что реально видно на снимке. В risks укажи то, что помешает монтажу: выступы, трубы, узкие проходы, неровные стены, положение окон и розеток.
В recommendations дай 2–4 практических совета по улучшению интерьера.
Идентификаторы в suggestion выбирай только из предложенного списка.`

/** Разбор фотографии помещения и подбор параметров. */
export async function analyzeInterior(
  settings: AiSettings,
  photo: ProjectPhoto,
  catalog: Catalog,
  signal?: AbortSignal,
): Promise<InteriorAnalysis> {
  const client = createClient(settings)
  const { mediaType, data } = splitDataUrl(photo.dataUrl)
  const model = settings.claudeModel.trim() || DEFAULT_CLAUDE_MODEL

  try {
    const response = await client.beta.messages.parse(
      {
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: zodOutputFormat(analysisSchema(catalog)),
        },
        // Отказ классификатора не должен ронять сценарий на замере.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
              {
                type: 'text',
                text: `Разбери это помещение и подбери параметры кухни.\n\nДоступный каталог:\n${catalogBrief(catalog)}`,
              },
            ],
          },
        ],
      },
      { signal },
    )

    if (response.stop_reason === 'refusal') {
      throw new AppError('unavailable', 'Модель отказалась разбирать этот снимок.')
    }

    const parsed = response.parsed_output
    if (!parsed) throw new AppError('unavailable', 'Не удалось разобрать ответ модели.')
    return parsed
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AppError('unavailable', 'Ключ Claude не принят. Проверьте его в настройках.')
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError('server', 'Слишком много запросов к Claude. Попробуйте через минуту.')
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AppError('network')
    }
    if (error instanceof Anthropic.APIError) {
      throw new AppError('server', `Claude вернул ошибку ${error.status ?? ''}`.trim())
    }
    throw new AppError('unknown')
  }
}

/** Проверка ключа: короткий запрос без изображения. */
export async function testClaude(settings: AiSettings): Promise<void> {
  const client = createClient(settings)
  const response = await client.messages.create({
    model: settings.claudeModel.trim() || DEFAULT_CLAUDE_MODEL,
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Ответь одним словом: готов' }],
  })
  if (response.content.length === 0) throw new AppError('unavailable')
}
