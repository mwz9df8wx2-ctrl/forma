import type { CatalogItem, CatalogItemInput, CatalogType, ProductionProfile } from '@shared/index'
import { serverRequest } from './client'

/** Каталог компании и производственный профиль на сервере. */

export async function listCatalog(type?: CatalogType, includeInactive = false): Promise<CatalogItem[]> {
  const query = new URLSearchParams()
  if (type) query.set('type', type)
  if (includeInactive) query.set('inactive', 'true')
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const data = await serverRequest<{ items: CatalogItem[] }>(`/catalog${suffix}`)
  return data.items
}

export async function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  const data = await serverRequest<{ item: CatalogItem }>('/catalog', { method: 'POST', body: input })
  return data.item
}

export async function updateCatalogItem(
  id: string,
  patch: Partial<Omit<CatalogItemInput, 'type'>>,
): Promise<CatalogItem> {
  const data = await serverRequest<{ item: CatalogItem }>(`/catalog/${id}`, {
    method: 'PATCH',
    body: patch,
  })
  return data.item
}

export async function disableCatalogItem(id: string): Promise<void> {
  await serverRequest(`/catalog/${id}`, { method: 'DELETE' })
}

export async function getProductionProfile(): Promise<{
  profile: ProductionProfile
  isDefault: boolean
}> {
  return serverRequest('/production-profile')
}

export async function saveProductionProfile(profile: ProductionProfile): Promise<ProductionProfile> {
  const data = await serverRequest<{ profile: ProductionProfile }>('/production-profile', {
    method: 'PATCH',
    body: profile,
  })
  return data.profile
}
