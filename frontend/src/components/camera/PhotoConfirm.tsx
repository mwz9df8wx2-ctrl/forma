import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatBytes } from '@/lib/format'
import type { ProjectPhoto } from '@/types'

/**
 * Подтверждение снимка. Кнопки подписаны словами — без безымянных иконок.
 */
export function PhotoConfirm({
  photo,
  onRetake,
  onConfirm,
  busy,
}: {
  photo: ProjectPhoto
  onRetake: () => void
  onConfirm: () => void
  busy?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0C0C0B] text-white">
      <div className="safe-top px-5 pt-4 pb-2">
        <p className="text-center text-[0.9375rem] font-medium">Фотография кухни</p>
        <p className="mt-1 text-center text-[0.8125rem] text-white/60">
          {photo.width}×{photo.height} · {formatBytes(photo.sizeBytes)}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        <img
          src={photo.dataUrl}
          alt="Снятая фотография кухни"
          className="max-h-full max-w-full animate-fade-in rounded-xl object-contain shadow-lift"
        />
      </div>

      <div className="safe-bottom border-t border-white/10 bg-[#131312] px-5 pt-4 pb-6">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 sm:flex-row">
          <Button
            variant="outlineLight"
            size="lg"
            fullWidth
            icon={<RotateCcw />}
            disabled={busy}
            onClick={onRetake}
          >
            Переснять
          </Button>
          <Button
            variant="light"
            size="lg"
            fullWidth
            icon={<Check strokeWidth={2.5} />}
            loading={busy}
            onClick={onConfirm}
          >
            Использовать
          </Button>
        </div>
      </div>
    </div>
  )
}
