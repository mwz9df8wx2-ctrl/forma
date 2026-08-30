import { useEffect, useState } from 'react'
import type { Permission, Role } from '@shared/index'
import { fetchPermissions } from '@/api/server/team'
import { useSession } from './useSession'

/**
 * Права текущего пользователя.
 *
 * Скрытая кнопка — удобство, а не защита: сервер проверяет право заново
 * на каждом запросе. Здесь мы только не ведём человека в отказ.
 */
export function usePermissions() {
  const { session } = useSession()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    if (!session) {
      setPermissions([])
      setRole(null)
      return
    }
    let cancelled = false
    fetchPermissions()
      .then((data) => {
        if (cancelled) return
        setPermissions(data.permissions)
        setRole(data.role)
      })
      .catch(() => {
        /* без связи с сервером интерфейс работает в локальном режиме */
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const loaded = role !== null

  return {
    role,
    permissions,
    loaded,
    /**
     * Пока роль неизвестна — до входа или пока ответ сервера в пути —
     * ничего не прячем. Иначе владелец на секунду теряет свои кнопки,
     * а при обрыве связи теряет их совсем. Настоящую проверку всё равно
     * делает сервер на каждом запросе.
     */
    can: (permission: Permission) => (loaded ? permissions.includes(permission) : true),
    /** Строгая проверка: право точно есть. Нужна там, где важен факт, а не удобство. */
    hasExactly: (permission: Permission) => permissions.includes(permission),
  }
}
