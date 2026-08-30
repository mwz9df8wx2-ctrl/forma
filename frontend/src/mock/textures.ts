import type { Texture } from '@/types'

export const MOCK_TEXTURES: Texture[] = [
  {
    id: 'matte',
    name: 'Матовая',
    description: 'Спокойная поверхность без выраженного блеска.',
    gloss: 0.05,
    grain: 'flat',
  },
  {
    id: 'glossy',
    name: 'Глянцевая',
    description: 'Зеркальная поверхность с яркими отражениями света.',
    gloss: 0.95,
    grain: 'gloss',
  },
  {
    id: 'satin',
    name: 'Сатиновая',
    description: 'Мягкое сдержанное свечение между матом и глянцем.',
    gloss: 0.45,
    grain: 'gloss',
  },
  {
    id: 'wood',
    name: 'Древесная',
    description: 'Выраженный рисунок древесного волокна.',
    gloss: 0.2,
    grain: 'wood',
  },
  {
    id: 'stone',
    name: 'Каменная',
    description: 'Минеральная поверхность с природным рисунком камня.',
    gloss: 0.25,
    grain: 'stone',
  },
  {
    id: 'textured',
    name: 'Текстурная',
    description: 'Рельефная поверхность с ощутимым тактильным рисунком.',
    gloss: 0.12,
    grain: 'linear',
  },
]
