import type { Permission, Role } from '@shared/index'
import { serverRequest } from './client'
import type { Session } from './client'

/**
 * Сотрудники компании.
 *
 * Права приходят с сервера, а не выводятся из роли на клиенте: список прав
 * роли может измениться, и интерфейс не должен об этом догадываться.
 */

export interface CompanyUser {
  id: string
  email: string
  name: string
  role: Role
  roleLabel: string
  active: boolean
  createdAt: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  expiresAt: string
  createdAt: string
}

export async function fetchPermissions(): Promise<{ role: Role; permissions: Permission[] }> {
  return serverRequest('/users/me/permissions')
}

export async function listUsers(): Promise<CompanyUser[]> {
  const data = await serverRequest<{ users: CompanyUser[] }>('/users')
  return data.users
}

export async function listInvitations(): Promise<Invitation[]> {
  const data = await serverRequest<{ invitations: Invitation[] }>('/users/invitations')
  return data.invitations
}

/** Ссылка показывается один раз: на сервере остаётся только её отпечаток. */
export async function inviteUser(
  email: string,
  role: Role,
): Promise<{ invitation: Invitation; token: string }> {
  return serverRequest('/users/invitations', { method: 'POST', body: { email, role } })
}

export async function revokeInvitation(id: string): Promise<void> {
  await serverRequest(`/users/invitations/${id}`, { method: 'DELETE' })
}

export async function updateUser(
  id: string,
  patch: { role?: Role; active?: boolean },
): Promise<CompanyUser> {
  const data = await serverRequest<{ user: CompanyUser }>(`/users/${id}`, {
    method: 'PATCH',
    body: patch,
  })
  return data.user
}

export async function acceptInvitation(input: {
  token: string
  name: string
  password: string
}): Promise<Session> {
  return serverRequest<Session>('/auth/accept-invitation', { method: 'POST', body: input })
}
