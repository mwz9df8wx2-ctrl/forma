import { buildLivingRoomLayout } from './livingRoom.ts'
import { buildWardrobeLayout } from './wardrobe.ts'
import type { FurnitureLayout } from './types.ts'

/**
 * Раскладка корпусной мебели по категории.
 *
 * Одна точка входа для чертежей и для сцены. Если бы каждый строил раскладку
 * сам, картинка и спецификация разошлись бы в числе секций — а расходятся
 * такие вещи не на экране, а на раскрое.
 */

export type ObjectCategory = 'wardrobe' | 'cabinet' | 'tv_zone' | 'living_room'

export function isObjectCategory(category: string): category is ObjectCategory {
  return (
    category === 'wardrobe' ||
    category === 'cabinet' ||
    category === 'tv_zone' ||
    category === 'living_room'
  )
}

export interface ObjectLayoutInput {
  category: ObjectCategory
  /** Габариты помещения в метрах. */
  room: { width: number; height: number; depth: number }
  /** Глубина изделия в метрах. */
  depth: number
  facadeLabel: string
}

export function buildObjectLayout(input: ObjectLayoutInput): FurnitureLayout {
  const { width: roomWidth, height: roomHeight } = input.room
  const offset = 0.1
  const width = Math.max(0.8, roomWidth - offset * 2)

  if (input.category === 'tv_zone' || input.category === 'living_room') {
    return buildLivingRoomLayout({
      room: input.room,
      width,
      // Гостиная мельче кухни: глубокая тумба съедает проход.
      depth: Math.min(input.depth, 0.45),
      offset,
      tvWidth: 1.2,
      tvBottom: 0.72,
      category: input.category,
      facadeLabel: input.facadeLabel,
    })
  }

  const cabinet = input.category === 'cabinet'
  return buildWardrobeLayout({
    room: input.room,
    width,
    // Тумба — низкий объём, шкаф идёт под потолок с технологическим зазором.
    height: cabinet ? Math.min(1.2, roomHeight - 0.2) : Math.min(2.6, roomHeight - 0.06),
    depth: input.depth,
    offset,
    hangingSections: cabinet ? 0 : 2,
    drawers: cabinet ? 3 : 4,
    topBox: !cabinet,
    // Крайняя секция остаётся открытой нишей: у неё нет ни дверцы, ни петель,
    // и в спецификацию она уходит именно такой.
    openSection: true,
    facadeLabel: input.facadeLabel,
    category: cabinet ? 'cabinet' : 'wardrobe',
  })
}
