import type { ProjectOption } from '@/types'

export const MOCK_OPTIONS: ProjectOption[] = [
  {
    id: 'keep-layout',
    name: 'Сохранить планировку помещения',
    description: 'Расстановка мебели останется такой же, как на фотографии.',
    defaultValue: true,
    group: 'preserve',
  },
  {
    id: 'keep-windows',
    name: 'Сохранить положение окон',
    description: 'Окна останутся на своих местах.',
    defaultValue: true,
    group: 'preserve',
  },
  {
    id: 'keep-doors',
    name: 'Сохранить положение дверей',
    description: 'Дверные проёмы не будут перенесены.',
    defaultValue: true,
    group: 'preserve',
  },
  {
    id: 'keep-perspective',
    name: 'Сохранить перспективу фотографии',
    description: 'Ракурс визуализации совпадёт с исходным снимком.',
    defaultValue: true,
    group: 'preserve',
  },
  {
    id: 'built-in-appliances',
    name: 'Добавить встроенную технику',
    description: 'Духовой шкаф и варочная панель в единой линии фасадов.',
    defaultValue: true,
    group: 'add',
  },
  {
    id: 'hood',
    name: 'Добавить вытяжку',
    description: 'Отдельная вытяжка над варочной панелью. Если вытяжка уже есть — не включайте.',
    defaultValue: false,
    group: 'add',
  },
  {
    id: 'accent-lighting',
    name: 'Добавить подсветку',
    description: 'Светодиодная линия под верхними шкафами и над рабочей зоной.',
    defaultValue: false,
    group: 'add',
  },
  {
    id: 'island',
    name: 'Добавить кухонный остров',
    description: 'Отдельный рабочий блок в центре помещения.',
    defaultValue: false,
    group: 'add',
  },
]
