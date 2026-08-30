import type { Material } from '@/types'

export const MOCK_MATERIALS: Material[] = [
  {
    id: 'mdf',
    name: 'МДФ',
    caption: 'Матовый',
    description: 'Плотная плита с ровным матовым покрытием. Универсальное решение для кухни.',
    preview: { base: '#D8D3CB', highlight: '#EFEDE7', shade: '#B6B0A6', grain: 'flat' },
  },
  {
    id: 'enamel',
    name: 'Эмаль',
    caption: 'Крашеный фасад',
    description: 'Крашеная поверхность с глубоким ровным цветом и мягким отражением.',
    preview: { base: '#E9E5DF', highlight: '#FFFFFF', shade: '#C6C0B6', grain: 'gloss' },
  },
  {
    id: 'solid-wood',
    name: 'Массив дерева',
    caption: 'Натуральное волокно',
    description: 'Натуральное дерево с выраженным рисунком волокна и тёплым тоном.',
    preview: { base: '#B98A57', highlight: '#DBB585', shade: '#8A6238', grain: 'wood' },
  },
  {
    id: 'veneer',
    name: 'Шпон',
    caption: 'Природный рисунок',
    description: 'Тонкий срез натурального дерева на прочной основе. Спокойный природный рисунок.',
    preview: { base: '#C79E6D', highlight: '#E5C89D', shade: '#97703F', grain: 'veneer' },
  },
  {
    id: 'chipboard',
    name: 'ЛДСП',
    caption: 'Практичный',
    description: 'Практичное покрытие с равномерной текстурой. Устойчиво к повседневной нагрузке.',
    preview: { base: '#CFC7BA', highlight: '#E8E2D7', shade: '#A69D8F', grain: 'linear' },
  },
  {
    id: 'acrylic',
    name: 'Акрил',
    caption: 'Глубокий глянец',
    description: 'Ровная плотная поверхность с выраженной глубиной и зеркальным отражением.',
    preview: { base: '#E4E7E6', highlight: '#FFFFFF', shade: '#B2B8B7', grain: 'gloss' },
  },
]
