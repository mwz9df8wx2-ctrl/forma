import type { Palette } from '@/types'

export const MOCK_PALETTES: Palette[] = [
  {
    id: 'warm-minimal',
    name: 'Тёплый минимализм',
    description: 'Светлая спокойная палитра с натуральными древесными акцентами.',
    swatches: [
      { name: 'Белый', hex: '#F2F1ED' },
      { name: 'Бежевый', hex: '#D8CAB4' },
      { name: 'Натуральный дуб', hex: '#C09A6B' },
    ],
  },
  {
    id: 'graphite-oak',
    name: 'Графит и дуб',
    description: 'Контрастная современная комбинация глубокого графита и натурального дерева.',
    swatches: [
      { name: 'Графит', hex: '#4A4C50' },
      { name: 'Белый', hex: '#F2F1ED' },
      { name: 'Натуральный дуб', hex: '#C09A6B' },
    ],
  },
  {
    id: 'clean-minimal',
    name: 'Чистый минимализм',
    description: 'Сдержанная светлая палитра для визуально просторного интерьера.',
    swatches: [
      { name: 'Белый', hex: '#F5F4F1' },
      { name: 'Светло-серый', hex: '#D9D6D0' },
      { name: 'Светлый дуб', hex: '#D2B78E' },
    ],
  },
  {
    id: 'dark-modern',
    name: 'Тёмная современная',
    description: 'Глубокая выразительная палитра для современного премиального интерьера.',
    swatches: [
      { name: 'Антрацит', hex: '#33363A' },
      { name: 'Графит', hex: '#4A4C50' },
      { name: 'Орех', hex: '#7A5233' },
    ],
  },
  {
    id: 'natural',
    name: 'Натуральная',
    description: 'Тёплая природная композиция с мягкими натуральными оттенками.',
    swatches: [
      { name: 'Молочный', hex: '#EAE2D5' },
      { name: 'Песочный', hex: '#C8B291' },
      { name: 'Дуб', hex: '#BE9765' },
      { name: 'Тёплый коричневый', hex: '#8A6440' },
    ],
  },
  {
    id: 'milk-olive',
    name: 'Молоко и олива',
    description: 'Мягкая светлая база с приглушённым зелёным акцентом.',
    swatches: [
      { name: 'Молочный', hex: '#EDE6DA' },
      { name: 'Оливковый', hex: '#6E7359' },
      { name: 'Светлый дуб', hex: '#CDAF83' },
    ],
  },
  {
    id: 'stone-sand',
    name: 'Камень и песок',
    description: 'Минеральная палитра с тёплым песочным подтоном и каменной столешницей.',
    swatches: [
      { name: 'Песочный', hex: '#C8B291' },
      { name: 'Светлый камень', hex: '#DED8CC' },
      { name: 'Тёплый серый', hex: '#A39C92' },
      { name: 'Орех', hex: '#7A5233' },
    ],
  },
  {
    id: 'clay-accent',
    name: 'Глина и белый',
    description: 'Светлый интерьер с одним тёплым терракотовым акцентом.',
    swatches: [
      { name: 'Белый', hex: '#F2F1ED' },
      { name: 'Терракотовый', hex: '#A9603F' },
      { name: 'Дуб', hex: '#C09A6B' },
    ],
  },
]
