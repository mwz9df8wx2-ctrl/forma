import type { Project } from '@/types'
import { buildSummary } from '@/lib/summary'
import { MOCK_CATALOG } from './catalog.ts'
import { DEMO_SEEDS } from './demoParams.ts'

/** Снимок «как было» для демонстрационных проектов. */
const EXISTING_PHOTO = '/samples/kitchen-before.jpg'

/**
 * Демонстрационные проекты витрины.
 * Все изображения лежат в проекте — внешних ссылок нет.
 */
export function createDemoProjects(): Project[] {
  return DEMO_SEEDS.map((seed) => ({
    id: seed.id,
    title: seed.title,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    photo: {
      dataUrl: EXISTING_PHOTO,
      width: 600,
      height: 400,
      sizeBytes: 48000,
      originalSizeBytes: 48000,
      fileName: 'kitchen.jpg',
      createdAt: seed.createdAt,
    },
    params: seed.params,
    previewUrl: seed.sample,
    summary: buildSummary(MOCK_CATALOG, seed.params),
    generationsCount: seed.generationsCount,
  }))
}
