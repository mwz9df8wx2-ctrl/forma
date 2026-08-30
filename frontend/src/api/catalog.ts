import type {
  Catalog,
  ColorOption,
  CountertopCatalog,
  Lighting,
  Material,
  Palette,
  ProjectOption,
  Style,
  Texture,
} from '@/types'
import { request } from './client'
import { USE_MOCK_API } from './config'
import { mockBackend } from './mockBackend'

export async function getMaterials(): Promise<Material[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).materials
  return request<Material[]>('/catalog/materials')
}

export async function getColors(): Promise<ColorOption[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).colors
  return request<ColorOption[]>('/catalog/colors')
}

export async function getTextures(): Promise<Texture[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).textures
  return request<Texture[]>('/catalog/textures')
}

export async function getPalettes(): Promise<Palette[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).palettes
  return request<Palette[]>('/catalog/palettes')
}

export async function getStyles(): Promise<Style[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).styles
  return request<Style[]>('/catalog/styles')
}

export async function getCountertops(): Promise<CountertopCatalog> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).countertops
  return request<CountertopCatalog>('/catalog/countertops')
}

export async function getLighting(): Promise<Lighting[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).lighting
  return request<Lighting[]>('/catalog/lighting')
}

export async function getOptions(): Promise<ProjectOption[]> {
  if (USE_MOCK_API) return (await mockBackend.getCatalog()).options
  return request<ProjectOption[]>('/catalog/options')
}

/** Один запрос на весь справочник — так экран настройки открывается мгновенно. */
export async function getCatalog(): Promise<Catalog> {
  if (USE_MOCK_API) return mockBackend.getCatalog()

  const [materials, colors, textures, palettes, styles, countertops, lighting, options] =
    await Promise.all([
      getMaterials(),
      getColors(),
      getTextures(),
      getPalettes(),
      getStyles(),
      getCountertops(),
      getLighting(),
      getOptions(),
    ])

  return { materials, colors, textures, palettes, styles, countertops, lighting, options }
}
