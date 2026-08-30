import { useCallback, useEffect, useState } from 'react'
import { deleteProject as apiDeleteProject, listProjects } from '@/api'
import { toAppError } from '@/lib/errors'
import type { Project } from '@/types'

/** Список проектов для раздела «Мои проекты». */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await listProjects())
    } catch (cause) {
      setError(toAppError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    setProjects((current) => current.filter((project) => project.id !== id))
    await apiDeleteProject(id)
  }, [])

  return { projects, loading, error, refresh, remove }
}
