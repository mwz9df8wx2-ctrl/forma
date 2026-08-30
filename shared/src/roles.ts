import * as z from 'zod'

/**
 * Роли и права.
 *
 * Роль — это не украшение интерфейса. Замерщик не должен менять цены,
 * конструктор не должен согласовывать проект за клиента, а генерацию
 * оплачивает компания, поэтому запускать её может не каждый.
 *
 * Права проверяются на сервере. Скрытая кнопка — удобство, а не защита.
 */

export const ROLES = ['owner', 'estimator', 'constructor'] as const
export const roleSchema = z.enum(ROLES)
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Владелец',
  estimator: 'Замерщик',
  constructor: 'Конструктор',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Полный доступ: каталог, цены, кредиты, сотрудники, согласование.',
  estimator: 'Замеры, спецификация, визуализация и смета. Цены и каталог только читает.',
  constructor: 'Чертежи и техпакет. Правит спецификацию, но не согласовывает и не тратит кредиты.',
}

export const PERMISSIONS = [
  'project.create',
  'project.edit',
  'project.archive',
  'spec.edit',
  'revision.approve',
  'measurement.edit',
  'catalog.read',
  'catalog.edit',
  'estimate.read',
  'estimate.create',
  'generation.run',
  'billing.read',
  'users.manage',
  'settings.edit',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ESTIMATOR: Permission[] = [
  'project.create',
  'project.edit',
  'spec.edit',
  'measurement.edit',
  'catalog.read',
  'estimate.read',
  'estimate.create',
  'generation.run',
  'billing.read',
]

const CONSTRUCTOR: Permission[] = [
  'project.edit',
  'spec.edit',
  'measurement.edit',
  'catalog.read',
  'estimate.read',
]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  estimator: ESTIMATOR,
  constructor: CONSTRUCTOR,
}

export function can(role: string, permission: Permission): boolean {
  const list = ROLE_PERMISSIONS[role as Role]
  return list ? list.includes(permission) : false
}

/** Понятная причина отказа. Пользователь должен знать, к кому идти. */
export function permissionDenialReason(permission: Permission): string {
  switch (permission) {
    case 'revision.approve':
      return 'Согласовать проект может только владелец компании.'
    case 'catalog.edit':
      return 'Каталог и цены меняет владелец компании.'
    case 'generation.run':
      return 'Запуск визуализации доступен владельцу и замерщику.'
    case 'users.manage':
      return 'Управление сотрудниками доступно владельцу компании.'
    case 'estimate.create':
      return 'Считать смету может владелец или замерщик.'
    case 'settings.edit':
      return 'Настройки компании меняет владелец.'
    case 'project.archive':
      return 'Архивировать проект может владелец компании.'
    default:
      return 'Недостаточно прав для этого действия.'
  }
}
