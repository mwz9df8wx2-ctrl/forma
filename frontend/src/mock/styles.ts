import type { Style } from '@/types'

export const MOCK_STYLES: Style[] = [
  {
    id: 'modern-minimal',
    name: 'Современный минимализм',
    description: 'Чистые линии, гладкие фасады без ручек и максимально спокойная композиция.',
    preview: { wall: '#EFEDE8', facade: '#E2DFD8', counter: '#CFCAC1', accent: '#B79A72' },
    traits: { openShelves: false, handles: 'hidden', framedDoors: false },
  },
  {
    id: 'modern-classic',
    name: 'Современная классика',
    description: 'Сдержанная филёнка и мягкие пропорции без избыточного декора.',
    preview: { wall: '#EDE8DF', facade: '#DCD3C4', counter: '#C6C0B4', accent: '#8A6440' },
    traits: { openShelves: false, handles: 'knob', framedDoors: true },
  },
  {
    id: 'scandinavian',
    name: 'Скандинавский',
    description: 'Светлая база, много воздуха и открытые полки с натуральным деревом.',
    preview: { wall: '#F4F2EC', facade: '#EDE9E1', counter: '#D2B78E', accent: '#9FA894' },
    traits: { openShelves: true, handles: 'bar', framedDoors: false },
  },
  {
    id: 'japandi',
    name: 'Japandi',
    description: 'Спокойное сочетание японского минимализма и скандинавской функциональности.',
    preview: { wall: '#EEE9E0', facade: '#D9CDB9', counter: '#BFB6A6', accent: '#6E7359' },
    traits: { openShelves: true, handles: 'hidden', framedDoors: false },
  },
  {
    id: 'loft',
    name: 'Лофт',
    description: 'Открытые конструкции, тёмный металл и фактурная бетонная стена.',
    preview: { wall: '#D9D6D1', facade: '#4A4C50', counter: '#A39C92', accent: '#7A5233' },
    traits: { openShelves: true, handles: 'bar', framedDoors: false },
  },
  {
    id: 'neoclassic',
    name: 'Неоклассика',
    description: 'Строгая симметрия, филёнчатые фасады и благородные светлые тона.',
    preview: { wall: '#F0ECE4', facade: '#E4DDD0', counter: '#DBD5C9', accent: '#9C8A6F' },
    traits: { openShelves: false, handles: 'knob', framedDoors: true },
  },
  {
    id: 'premium-modern',
    name: 'Премиальный современный',
    description: 'Глубокие тона, крупные плоскости и подчёркнуто дорогие материалы.',
    preview: { wall: '#E6E3DD', facade: '#33363A', counter: '#CFCAC1', accent: '#B08D5F' },
    traits: { openShelves: false, handles: 'hidden', framedDoors: false },
  },
]
