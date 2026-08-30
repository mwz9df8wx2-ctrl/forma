import type { CatalogItem } from '@shared/index'
import { darken, lighten } from '@/lib/color'
import type { Catalog, ColorOption, CountertopColor, GrainKind, Material, Texture } from '@/types'

/**
 * Каталог компании → справочник экрана параметров.
 *
 * В цехе фасад продаётся одним артикулом: коллекция, цвет и отделка вместе.
 * Экран параметров разделяет материал, цвет и фактуру — так проще выбирать.
 * Здесь одно превращается в другое, чтобы приложение предлагало клиенту только
 * то, что компания действительно делает.
 */

const MATERIAL_NAMES: Record<string, { name: string; caption: string; description: string }> = {
  mdf: { name: 'МДФ', caption: 'Матовый', description: 'Плотная плита с ровным матовым покрытием.' },
  enamel: {
    name: 'Эмаль',
    caption: 'Крашеный фасад',
    description: 'Крашеная поверхность с глубоким ровным цветом.',
  },
  solid_wood: {
    name: 'Массив дерева',
    caption: 'Натуральное волокно',
    description: 'Натуральное дерево с выраженным рисунком волокна.',
  },
  veneer: {
    name: 'Шпон',
    caption: 'Природный рисунок',
    description: 'Тонкий срез натурального дерева на прочной основе.',
  },
  chipboard: { name: 'ЛДСП', caption: 'Практичный', description: 'Практичное покрытие с равномерной текстурой.' },
  acrylic: { name: 'Акрил', caption: 'Глубокий глянец', description: 'Ровная плотная поверхность с отражением.' },
  plastic: { name: 'Пластик', caption: 'Износостойкий', description: 'Стойкое покрытие для активной кухни.' },
}

const FINISH_NAMES: Record<string, { name: string; description: string; gloss: number; grain: GrainKind }> = {
  matte: { name: 'Матовая', description: 'Спокойная поверхность без выраженного блеска.', gloss: 0.05, grain: 'flat' },
  satin: { name: 'Сатиновая', description: 'Мягкое сдержанное свечение.', gloss: 0.45, grain: 'gloss' },
  gloss: { name: 'Глянцевая', description: 'Зеркальная поверхность с яркими отражениями.', gloss: 0.95, grain: 'gloss' },
  wood: { name: 'Древесная', description: 'Выраженный рисунок древесного волокна.', gloss: 0.2, grain: 'wood' },
  stone: { name: 'Каменная', description: 'Минеральная поверхность с рисунком камня.', gloss: 0.25, grain: 'stone' },
  textured: { name: 'Текстурная', description: 'Рельефная поверхность с тактильным рисунком.', gloss: 0.12, grain: 'linear' },
}

const COUNTERTOP_MATERIALS: Record<string, { name: string; caption: string; description: string; grain: GrainKind }> = {
  quartz: { name: 'Кварц', caption: 'Кварцевый агломерат', description: 'Плотная однородная поверхность.', grain: 'speck' },
  stone: { name: 'Натуральный камень', caption: 'Природный рисунок', description: 'Уникальный рисунок прожилок.', grain: 'marble' },
  hpl: { name: 'HPL', caption: 'Компакт-ламинат', description: 'Тонкая прочная столешница.', grain: 'linear' },
  wood: { name: 'Дерево', caption: 'Массив', description: 'Тёплая деревянная поверхность.', grain: 'wood' },
  porcelain: { name: 'Керамогранит', caption: 'Крупноформатный', description: 'Износостойкая плита.', grain: 'stone' },
  chipboard: { name: 'ЛДСП', caption: 'Бюджетная', description: 'Практичная столешница с плёночным покрытием.', grain: 'linear' },
}

const isLight = (hex: string): boolean => {
  const value = Number.parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55
}

/**
 * Собирает справочник из записей каталога.
 * Палитры, стили и схемы освещения остаются из встроенного набора: это
 * дизайнерские пресеты, а не складские позиции.
 */
export function buildCatalogFromItems(items: CatalogItem[], base: Catalog): Catalog {
  const facades = items.filter((item) => item.type === 'facade' && item.active)
  const countertops = items.filter((item) => item.type === 'countertop' && item.active)

  if (facades.length === 0 && countertops.length === 0) return base

  const materials: Material[] = []
  const seenMaterials = new Set<string>()
  const colors: ColorOption[] = []
  const textures: Texture[] = []
  const seenFinishes = new Set<string>()

  for (const item of facades) {
    const attributes = item.attributes as {
      material: string
      colorName: string
      colorHex: string
      finish: string
    }

    if (!seenMaterials.has(attributes.material)) {
      seenMaterials.add(attributes.material)
      const preset = MATERIAL_NAMES[attributes.material]
      if (preset) {
        materials.push({
          id: attributes.material,
          name: preset.name,
          caption: preset.caption,
          description: preset.description,
          preview: {
            base: attributes.colorHex,
            highlight: lighten(attributes.colorHex, 0.2),
            shade: darken(attributes.colorHex, 0.2),
            grain: FINISH_NAMES[attributes.finish]?.grain ?? 'flat',
          },
        })
      }
    }

    // Идентификатором цвета становится запись каталога: в спецификацию
    // попадает конкретный артикул компании, а не абстрактный оттенок.
    colors.push({
      id: item.id,
      name: attributes.colorName,
      hex: attributes.colorHex,
      grain: FINISH_NAMES[attributes.finish]?.grain ?? 'flat',
      tone: isLight(attributes.colorHex) ? 'light' : 'dark',
      description: `${item.name}${item.demo ? ' · демонстрационная запись' : ''}`,
    })

    if (!seenFinishes.has(attributes.finish)) {
      seenFinishes.add(attributes.finish)
      const preset = FINISH_NAMES[attributes.finish]
      if (preset) {
        textures.push({
          id: attributes.finish,
          name: preset.name,
          description: preset.description,
          gloss: preset.gloss,
          grain: preset.grain,
        })
      }
    }
  }

  const countertopMaterials: Catalog['countertops']['materials'] = []
  const seenCountertopMaterials = new Set<string>()
  const countertopColors: CountertopColor[] = []

  for (const item of countertops) {
    const attributes = item.attributes as {
      material: string
      decor: string
      colorHex: string
    }
    if (!seenCountertopMaterials.has(attributes.material)) {
      seenCountertopMaterials.add(attributes.material)
      const preset = COUNTERTOP_MATERIALS[attributes.material]
      if (preset) {
        countertopMaterials.push({
          id: attributes.material,
          name: preset.name,
          caption: preset.caption,
          description: preset.description,
          preview: {
            base: attributes.colorHex,
            highlight: lighten(attributes.colorHex, 0.18),
            shade: darken(attributes.colorHex, 0.18),
            grain: preset.grain,
          },
        })
      }
    }
    countertopColors.push({
      id: item.id,
      name: attributes.decor,
      hex: attributes.colorHex,
      grain: COUNTERTOP_MATERIALS[attributes.material]?.grain ?? 'stone',
      tone: isLight(attributes.colorHex) ? 'light' : 'dark',
      description: `${item.name}${item.demo ? ' · демонстрационная запись' : ''}`,
    })
  }

  return {
    ...base,
    materials: materials.length > 0 ? materials : base.materials,
    colors: colors.length > 0 ? colors : base.colors,
    textures: textures.length > 0 ? textures : base.textures,
    countertops: {
      materials: countertopMaterials.length > 0 ? countertopMaterials : base.countertops.materials,
      colors: countertopColors.length > 0 ? countertopColors : base.countertops.colors,
    },
  }
}
