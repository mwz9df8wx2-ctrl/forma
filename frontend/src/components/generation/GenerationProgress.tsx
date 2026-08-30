import { Check, LoaderCircle } from 'lucide-react'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import type { GenerationStage } from '@/types'

/**
 * Экран ожидания. Пользователю показываем только понятные шаги,
 * без технических терминов.
 */
export function GenerationProgress({
  photoUrl,
  stages,
  stageIndex,
  progress,
}: {
  photoUrl: string | null
  stages: GenerationStage[]
  stageIndex: number
  /** null — бэкенд не сообщает прогресс, показываем бесконечный индикатор. */
  progress: number | null
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface-3 shadow-card">
        <div className="aspect-[4/3] w-full">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Исходная фотография кухни"
              className="size-full scale-[1.02] object-cover opacity-70 blur-[1px]"
            />
          ) : (
            <div className="paper size-full" />
          )}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/25 via-transparent to-canvas/45" />
          <div className="absolute inset-x-0 h-px animate-scan bg-white/80 shadow-[0_0_18px_4px_rgba(255,255,255,0.55)]" />
        </div>
      </div>

      <h1 className="mt-8 text-center text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
        Создаём визуализацию
      </h1>
      <p className="mt-2 text-center text-[0.875rem] text-muted">
        Не закрывайте страницу — это займёт меньше минуты.
      </p>

      <Progress
        value={progress}
        label="Ход создания визуализации"
        className="mt-7 w-full max-w-xs"
      />

      <ol className="mt-8 w-full space-y-1.5" aria-label="Этапы">
        {stages.map((stage, index) => {
          const done = index < stageIndex
          const active = index === stageIndex
          return (
            <li
              key={stage.id}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-300',
                active && 'bg-surface shadow-hair',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300',
                  done && 'border-ink bg-ink text-white',
                  active && 'border-clay text-clay',
                  !done && !active && 'border-line-strong text-transparent',
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : active ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : null}
              </span>
              <span
                className={cn(
                  'text-[0.9375rem] transition-colors duration-300',
                  done && 'text-muted',
                  active && 'font-medium text-ink',
                  !done && !active && 'text-faint',
                )}
              >
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
