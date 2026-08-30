import { cn } from '@/lib/cn'
import type { SurfacePreview } from '@/types'
import { surfaceStyle } from './surfaceStyle'

/** Прямоугольное превью материала для карточки выбора. */
export function SurfaceTile({
  preview,
  className,
  ratio = 'aspect-[4/3]',
}: {
  preview: SurfacePreview
  className?: string
  ratio?: string
}) {
  return (
    <div
      aria-hidden
      style={surfaceStyle(preview)}
      className={cn(
        'w-full overflow-hidden border-b border-black/5 bg-surface-3',
        ratio,
        className,
      )}
    />
  )
}
