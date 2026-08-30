import type { GenerationRequestPayload, ProjectParams } from '@/types'
import { REQUIRED_PARAMS } from '@/mock/catalog'

/** Какие обязательные параметры ещё не выбраны. */
export function missingParams(params: ProjectParams): string[] {
  return REQUIRED_PARAMS.filter(({ key }) => !params[key]).map(({ label }) => label)
}

/**
 * Структурированные параметры для бэкенда.
 * Текст запроса к ИИ формируется на сервере — фронтенд его не собирает.
 */
export function buildGenerationPayload(params: ProjectParams): GenerationRequestPayload {
  return {
    category: params.category,
    layout_kind: params.layoutKind,
    material_id: params.materialId ?? '',
    color_id: params.colorId ?? '',
    palette_id: params.paletteId ?? '',
    texture_id: params.textureId ?? '',
    style_id: params.styleId ?? '',
    countertop_id: params.countertopMaterialId ?? '',
    countertop_color_id: params.countertopColorId ?? '',
    lighting_id: params.lightingId ?? '',
    dimensions: params.dimensions,
    options: params.options,
  }
}
