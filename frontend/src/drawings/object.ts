import { buildBathroomLayout } from './bathroom.ts'
import { buildHallwayLayout } from './hallway.ts'
import { buildLivingRoomLayout } from './livingRoom.ts'
import { buildShelvingLayout } from './shelving.ts'
import { buildWardrobeLayout } from './wardrobe.ts'
import type { FurnitureLayout } from './types.ts'

/**
 * Раскладка корпусной мебели по категории.
 *
 * Одна точка входа для чертежей и для сцены. Если бы каждый строил раскладку
 * сам, картинка и спецификация разошлись бы в числе секций — а расходятся
 * такие вещи не на экране, а на раскрое.
 */

export type ObjectCategory =
  | 'wardrobe'
  | 'cabinet'
  | 'tv_zone'
  | 'living_room'
  | 'hallway'
  | 'bathroom'
  | 'shelving'

const OBJECT_CATEGORIES: readonly string[] = [
  'wardrobe',
  'cabinet',
  'tv_zone',
  'living_room',
  'hallway',
  'bathroom',
  'shelving',
]

export function isObjectCategory(category: string): category is ObjectCategory {
  return OBJECT_CATEGORIES.includes(category)
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

  if (input.category === 'shelving') {
    return buildShelvingLayout({
      room: input.room,
      width,
      height: Math.min(2.4, roomHeight - 0.15),
      depth: Math.min(input.depth, 0.4),
      offset,
      // Толщину полки берёт производственный профиль; 16 мм — самый ходовой лист.
      shelfThicknessMm: 16,
      closedBase: true,
      facadeLabel: input.facadeLabel,
    })
  }

  if (input.category === 'hallway') {
    return buildHallwayLayout({
      room: input.room,
      width,
      // Прихожая идёт под потолок: свободной стены в коридоре мало.
      height: Math.min(2.4, roomHeight - 0.1),
      offset,
      facadeLabel: input.facadeLabel,
    })
  }

  if (input.category === 'bathroom') {
    return buildBathroomLayout({
      room: input.room,
      width,
      offset,
      facadeLabel: input.facadeLabel,
    })
  }

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
