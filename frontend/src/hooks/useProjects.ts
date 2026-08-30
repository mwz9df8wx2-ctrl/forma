import { useCallback, useEffect, useState } from 'react'
import { deleteProject as apiDeleteProject, listProjects } from '@/api'
import { archiveProject, listProjects as listServerProjects } from '@/api/server/projects'
import { toAppError } from '@/lib/errors'
import { useSession } from './useSession'

/** Карточка проекта в списке — одинаковая для локального и серверного режима. */
export interface ProjectListItem {
  id: string
  title: string
  updatedAt: string
  summary: string
  previewUrl: string | null
  photoUrl: string | null
  generationsCount: number
  status: string | null
  source: 'server' | 'local'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  measurement: 'Замер',
  requirements_confirmed: 'Параметры подтверждены',
  ready_for_visualization: 'Готов к визуализации',
  visualization_ready: 'Есть варианты',
  client_approved: 'Согласован клиентом',
  technical_package_ready: 'Техпакет готов',
  completed: 'Завершён',
  archived: 'В архиве',
}

export function projectStatusLabel(status: string | null): string | null {
  if (!status) return null
  return STATUS_LABELS[status] ?? null
}

/**
 * Список проектов.
 * При наличии сессии источник правды — сервер; без него работает локальный режим.
 */
export function useProjects() {
  const { session } = useSession()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (session) {
        const rows = await listServerProjects()
        setProjects(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            updatedAt: row.updatedAt,
            summary: row.clientName ?? 'Клиент не указан',
            previewUrl: null,
            photoUrl: null,
            generationsCount: 0,
            status: row.status,
            source: 'server' as const,
          })),
        )
      } else {
        const rows = await listProjects()
        setProjects(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            updatedAt: row.updatedAt,
            summary: row.summary,
            previewUrl: row.previewUrl,
            photoUrl: row.photo?.dataUrl ?? null,
            generationsCount: row.generationsCount,
            status: null,
            source: 'local' as const,
          })),
        )
      }
    } catch (cause) {
      setError(toAppError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const remove = useCallback(
    async (id: string) => {
      setProjects((current) => current.filter((project) => project.id !== id))
      if (session) await archiveProject(id)
      else await apiDeleteProject(id)
    },
    [session],
  )

  return { projects, loading, error, refresh, remove, source: session ? 'server' : 'local' }
}
