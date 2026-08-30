import { DEFAULT_DIMENSIONS, DEFAULT_OPTION_VALUES } from './catalog.ts'
import type { ProjectParams } from '../types/index.ts'

function params(partial: Partial<ProjectParams>): ProjectParams {
  return {
    layoutKind: 'corner',
    dimensions: { ...DEFAULT_DIMENSIONS },
    materialId: 'mdf',
    colorId: 'white',
    textureId: 'matte',
    paletteId: 'warm-minimal',
    styleId: 'modern-minimal',
    countertopMaterialId: 'quartz',
    countertopColorId: 'top-white',
    lightingId: 'natural',
    options: { ...DEFAULT_OPTION_VALUES },
    ...partial,
  }
}

/** «Как было» — снимок существующей кухни для демонстрационных проектов. */
export const EXISTING_KITCHEN: ProjectParams = params({
  materialId: 'chipboard',
  colorId: 'beige',
  textureId: 'textured',
  paletteId: 'stone-sand',
  styleId: 'modern-classic',
  countertopMaterialId: 'hpl',
  countertopColorId: 'top-grey',
  lightingId: 'neutral',
  options: { ...DEFAULT_OPTION_VALUES, island: false, 'accent-lighting': false },
})

export interface DemoSeed {
  id: string
  title: string
  createdAt: string
  variant: number
  generationsCount: number
  sample: string
  params: ProjectParams
}

/** Демонстрационные проекты витрины. Изображения к ним рендерятся при сборке. */
export const DEMO_SEEDS: DemoSeed[] = [
  {
    id: 'prj_demo_ivanov',
    title: 'Кухня — Ивановы',
    createdAt: '2026-08-27T10:20:00.000Z',
    variant: 0,
    generationsCount: 3,
    sample: '/samples/project-1.jpg',
    params: params({
      materialId: 'enamel',
      colorId: 'graphite',
      textureId: 'matte',
      paletteId: 'graphite-oak',
      styleId: 'premium-modern',
      countertopMaterialId: 'natural-stone',
      countertopColorId: 'top-marble',
      lightingId: 'warm',
      options: { ...DEFAULT_OPTION_VALUES, island: true, 'accent-lighting': true },
    }),
  },
  {
    id: 'prj_demo_severny',
    title: 'Кухня — ЖК «Северный», 42',
    createdAt: '2026-08-24T14:05:00.000Z',
    variant: 1,
    generationsCount: 2,
    sample: '/samples/project-2.jpg',
    params: params({
      materialId: 'veneer',
      colorId: 'oak',
      textureId: 'wood',
      paletteId: 'natural',
      styleId: 'japandi',
      countertopMaterialId: 'quartz',
      countertopColorId: 'top-light-stone',
      lightingId: 'warm-diffused',
    }),
  },
  {
    id: 'prj_demo_petrov',
    title: 'Кухня — Петровы',
    createdAt: '2026-08-19T08:45:00.000Z',
    variant: 2,
    generationsCount: 1,
    sample: '/samples/project-3.jpg',
    params: params({
      materialId: 'acrylic',
      colorId: 'milk',
      textureId: 'glossy',
      paletteId: 'clean-minimal',
      styleId: 'scandinavian',
      countertopMaterialId: 'porcelain',
      countertopColorId: 'top-grey',
      lightingId: 'bright-white',
    }),
  },
]

/** Параметры примера на главном экране. */
export const HERO_PARAMS: ProjectParams = params({
  materialId: 'veneer',
  colorId: 'oak',
  textureId: 'wood',
  paletteId: 'warm-minimal',
  styleId: 'japandi',
  countertopMaterialId: 'quartz',
  countertopColorId: 'top-light-stone',
  lightingId: 'warm-diffused',
  options: { ...DEFAULT_OPTION_VALUES, island: true, 'accent-lighting': true },
})
