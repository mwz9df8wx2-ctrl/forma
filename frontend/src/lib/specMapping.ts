import { emptySpec, type ProjectSpec } from '@shared/index'
import type { ProjectParams } from '@/types'

/**
 * Мост между внутренним состоянием экрана настройки и спецификацией проекта.
 *
 * ProjectSpec — то, что хранится на сервере и служит источником правды.
 * ProjectParams — рабочая форма для экрана параметров. Пока фронтенд не
 * переведён на спецификацию целиком, преобразование живёт здесь, в одном месте.
 */

export function paramsToSpec(params: ProjectParams, base?: ProjectSpec): ProjectSpec {
  const spec = base ? { ...base } : emptySpec('kitchen')
  return {
    ...spec,
    category: params.category,
    layoutKind: params.layoutKind,
    dimensions: {
      roomWidth: params.dimensions.roomWidth,
      roomDepth: params.dimensions.roomDepth,
      roomHeight: params.dimensions.roomHeight,
      counterHeight: params.dimensions.counterHeight,
      counterDepth: params.dimensions.counterDepth,
      sideRun: params.dimensions.sideRun,
    },
    materials: {
      materialId: params.materialId,
      colorId: params.colorId,
      textureId: params.textureId,
      paletteId: params.paletteId,
      styleId: params.styleId,
      countertopMaterialId: params.countertopMaterialId,
      countertopColorId: params.countertopColorId,
      lightingId: params.lightingId,
    },
    options: { ...params.options },
  }
}

export function specToParams(spec: ProjectSpec, fallback: ProjectParams): ProjectParams {
  return {
    category: spec.category,
    layoutKind: spec.layoutKind,
    dimensions: {
      roomWidth: spec.dimensions.roomWidth || fallback.dimensions.roomWidth,
      roomDepth: spec.dimensions.roomDepth || fallback.dimensions.roomDepth,
      roomHeight: spec.dimensions.roomHeight || fallback.dimensions.roomHeight,
      counterHeight: spec.dimensions.counterHeight || fallback.dimensions.counterHeight,
      counterDepth: spec.dimensions.counterDepth || fallback.dimensions.counterDepth,
      sideRun: spec.dimensions.sideRun,
    },
    materialId: spec.materials.materialId,
    colorId: spec.materials.colorId,
    textureId: spec.materials.textureId ?? fallback.textureId,
    paletteId: spec.materials.paletteId ?? fallback.paletteId,
    styleId: spec.materials.styleId ?? fallback.styleId,
    countertopMaterialId: spec.materials.countertopMaterialId ?? fallback.countertopMaterialId,
    countertopColorId: spec.materials.countertopColorId ?? fallback.countertopColorId,
    lightingId: spec.materials.lightingId ?? fallback.lightingId,
    options: Object.keys(spec.options).length > 0 ? { ...spec.options } : { ...fallback.options },
  }
}
