import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOpenProject } from '@/hooks/useOpenProject'
import { useSession } from '@/hooks/useSession'
import { createProject } from '@/api/server/projects'
import { useProject } from '@/hooks/useProject'
import { useProjects } from '@/hooks/useProjects'
import { useToast } from '@/hooks/useToast'
import { plural } from '@/lib/format'
import type { ProjectListItem } from '@/hooks/useProjects'

export function ProjectsPage() {
  const navigate = useNavigate()
  const { projects, loading, error, remove, refresh } = useProjects()
  const openListItem = useOpenProject()
  const { session } = useSession()
  const { resetProject, setTitle, setServerProject } = useProject()
  const [creating, setCreating] = useState(false)

  /**
   * Новый проект. С сессией он заводится на сервере: у него сразу появляется
   * первая ревизия, и дальше спецификация версионируется.
   */
  const handleCreate = async () => {
    if (!session) {
      navigate('/')
      return
    }
    setCreating(true)
    try {
      const { project, revision } = await createProject({
        title: `Проект от ${new Date().toLocaleDateString('ru-RU')}`,
      })
      resetProject()
      setTitle(project.title)
      setServerProject({ id: project.id, revisionId: revision.id })
      navigate('/setup')
    } catch (error) {
      showError(error)
    } finally {
      setCreating(false)
    }
  }
  const { show, showError } = useToast()
  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null)

  const handleOpen = (project: ProjectListItem) => {
    void openListItem(project)
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    const project = pendingDelete
    setPendingDelete(null)
    try {
      await remove(project.id)
      show({ title: 'Проект удалён', variant: 'success' })
    } catch (cause) {
      showError(cause)
      void refresh()
    }
  }

  return (
    <>
      <PageHeader
        showLogo
        title="Мои проекты"
        subtitle={
          projects.length > 0
            ? `${projects.length} ${plural(projects.length, ['проект', 'проекта', 'проектов'])} на этом устройстве.`
            : 'Все визуализации, созданные на этом устройстве.'
        }
        action={
          <div className="hidden lg:block">
            <Button
              variant="primary"
              size="md"
              icon={<Plus />}
              loading={creating}
              onClick={() => void handleCreate()}
            >
              {session ? 'Новый проект' : 'Новая визуализация'}
            </Button>
          </div>
        }
      />

      <div className="px-5 pt-7 pb-10 lg:px-10">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-64 rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-line bg-surface p-5 text-center">
            <p className="text-[0.9375rem] font-medium text-ink">{error}</p>
            <Button variant="secondary" size="md" className="mt-4" onClick={() => void refresh()}>
              Повторить
            </Button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <EmptyState
            icon={<LayoutGrid />}
            title="У вас пока нет проектов."
            description="Создайте первую визуализацию прямо сейчас — понадобится только фотография кухни."
            action={
              <Button
                variant="primary"
                size="lg"
                icon={<Plus />}
                loading={creating}
                onClick={() => void handleCreate()}
              >
                {session ? 'Создать проект' : 'Новая визуализация'}
              </Button>
            }
          />
        )}

        {!loading && projects.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard
                  project={project}
                  onOpen={() => handleOpen(project)}
                  onDelete={() => setPendingDelete(project)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Удалить проект?"
        description={
          pendingDelete
            ? `«${pendingDelete.title}» будет удалён с этого устройства. Действие нельзя отменить.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" size="md" fullWidth onClick={() => setPendingDelete(null)}>
              Отмена
            </Button>
            <Button variant="danger" size="md" fullWidth onClick={() => void handleDelete()}>
              Удалить
            </Button>
          </>
        }
      />
    </>
  )
}
