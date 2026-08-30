import { clearSession, saveSession, serverRequest, type Session } from './client'

/** Вход, регистрация и выход. */

export async function register(input: {
  companyName: string
  name: string
  email: string
  password: string
}): Promise<Session> {
  const session = await serverRequest<Session>('/auth/register', { method: 'POST', body: input })
  saveSession(session)
  return session
}

export async function login(email: string, password: string): Promise<Session> {
  const session = await serverRequest<Session>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  saveSession(session)
  return session
}

export async function logout(): Promise<void> {
  try {
    await serverRequest('/auth/logout', { method: 'POST' })
  } finally {
    clearSession()
  }
}
