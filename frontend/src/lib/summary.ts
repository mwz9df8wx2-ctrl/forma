import type { Catalog, ProjectParams } from '@/types'

const findName = <T extends { id: string; name: string }>(items: T[], id: string | null) =>
  items.find((item) => item.id === id)?.name ?? null

/** Короткая сводка для карточки проекта: «Графит / дуб». */
export function buildSummary(catalog: Catalog, params: ProjectParams): string {
  const color = findName(catalog.colors, params.colorId)
  const material = findName(catalog.materials, params.materialId)
  const parts = [color, material?.toLowerCase()].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : 'Параметры не выбраны'
}

export interface SelectionRow {
  label: string
  value: string
}

/** Развёрнутая сводка выбора — показывается на десктопе и на экране результата. */
export function describeSelection(catalog: Catalog, params: ProjectParams): SelectionRow[] {
  const rows: SelectionRow[] = [
    { label: 'Материал', value: findName(catalog.materials, params.materialId) ?? '—' },
    { label: 'Цвет', value: findName(catalog.colors, params.colorId) ?? '—' },
    { label: 'Фактура', value: findName(catalog.textures, params.textureId) ?? '—' },
    {
      label: 'Столешница',
      value: [
        findName(catalog.countertops.materials, params.countertopMaterialId),
        findName(catalog.countertops.colors, params.countertopColorId)?.toLowerCase(),
      ]
        .filter(Boolean)
        .join(', ') || '—',
    },
    { label: 'Палитра', value: findName(catalog.palettes, params.paletteId) ?? '—' },
    { label: 'Стиль', value: findName(catalog.styles, params.styleId) ?? '—' },
    { label: 'Освещение', value: findName(catalog.lighting, params.lightingId) ?? '—' },
  ]
  return rows
}

/** Активные дополнительные параметры — для сводки. */
export function describeOptions(catalog: Catalog, params: ProjectParams): string[] {
  return catalog.options.filter((option) => params.options[option.id]).map((option) => option.name)
}
