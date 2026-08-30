import { Images, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { formatDate, plural } from '@/lib/format'
import type { Project } from '@/types'

export function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onDelete: () => void
}) {
  const image = project.previewUrl ?? project.photo?.dataUrl ?? null

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:outline-none"
        aria-label={`Открыть проект «${project.title}»`}
      >
        <span className="block aspect-[3/2] w-full overflow-hidden bg-surface-3">
          {image ? (
            <img
              src={image}
              alt=""
              className="size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02]"
            />
          ) : (
            <span className="paper flex size-full items-center justify-center text-faint">
              <Images className="size-6" />
            </span>
          )}
        </span>

        <span className="block p-4">
          <span className="block truncate text-[0.9375rem] leading-tight font-medium text-ink">
            {project.title}
          </span>
          <span className="mt-1.5 block text-[0.8125rem] text-muted">
            {formatDate(project.updatedAt)}
          </span>
          <span className="mt-2.5 flex items-center gap-2 text-[0.8125rem] text-graphite">
            <span className="truncate">{project.summary}</span>
            {project.generationsCount > 0 && (
              <span className="shrink-0 text-faint">
                · {project.generationsCount}{' '}
                {plural(project.generationsCount, ['вариант', 'варианта', 'вариантов'])}
              </span>
            )}
          </span>
        </span>
      </button>

      <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
        <IconButton
          label={`Удалить проект «${project.title}»`}
          size="sm"
          variant="overlay"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </article>
  )
}
