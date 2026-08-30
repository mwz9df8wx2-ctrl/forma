import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProject } from '@/api'
import { getProject as getServerProject } from '@/api/server/projects'
import { specToParams } from '@/lib/specMapping'
import { DEFAULT_PARAMS } from '@/mock/catalog'
import { useProject } from './useProject'
import { useToast } from './useToast'
import type { ProjectListItem } from './useProjects'

/** Открытие проекта из списка: и локального, и серверного. */
export function useOpenProject() {
  const navigate = useNavigate()
  const { openProject, resetProject, setTitle, updateParams, setServerProject } = useProject()
  const { showError } = useToast()

  return useCallback(
    async (item: ProjectListItem) => {
      try {
        if (item.source === 'local') {
          const project = await getProject(item.id)
          if (project) openProject(project)
        } else {
          const { project, revision } = await getServerProject(item.id)
          resetProject()
          setTitle(project.title)
          setServerProject({ id: project.id, revisionId: revision?.id ?? null })
          if (revision) updateParams(specToParams(revision.spec, DEFAULT_PARAMS))
        }
        navigate('/setup')
      } catch (error) {
        showError(error)
      }
    },
    [navigate, openProject, resetProject, setTitle, updateParams, setServerProject, showError],
  )
}
