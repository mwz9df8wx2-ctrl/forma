import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { GenerationProgress } from '@/components/generation/GenerationProgress'
import { Button } from '@/components/ui/Button'
import { useGeneration } from '@/hooks/useGeneration'
import { useProject } from '@/hooks/useProject'

export function GenerationPage() {
  const navigate = useNavigate()
  const { photo } = useProject()
  const { generation, stages, stageIndex, progress, isCompleted, isFailed, startGeneration, cancelGeneration } =
    useGeneration()

  useEffect(() => {
    // Фотография необязательна: без неё сцена строится по размерам.
    if (!generation) {
      navigate('/setup', { replace: true })
      return
    }
    if (isCompleted) navigate('/results', { replace: true })
  }, [generation, isCompleted, navigate])

  if (!generation) return null

  return (
    <>
      <FlowHeader
        title="Создание визуализации"
        onBack={() => {
          cancelGeneration()
          navigate('/setup')
        }}
        backLabel="Вернуться к параметрам"
      />

      <div className="flex flex-1 flex-col justify-center px-5 py-10 lg:px-10 lg:py-14">
        {isFailed ? (
          <div className="mx-auto w-full max-w-md text-center">
            <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <CircleAlert className="size-5" />
            </span>
            <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
              Не удалось создать визуализацию
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
              {generation.error?.message ?? 'Попробуйте ещё раз — параметры сохранены.'}
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row-reverse">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => void startGeneration()}
              >
                Попробовать снова
              </Button>
              <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/setup')}>
                Изменить параметры
              </Button>
            </div>
          </div>
        ) : (
          <>
            <GenerationProgress
              photoUrl={photo?.dataUrl ?? null}
              stages={stages}
              stageIndex={stageIndex}
              progress={progress}
            />
            <div className="mx-auto mt-9 w-full max-w-md">
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => {
                  cancelGeneration()
                  navigate('/setup')
                }}
              >
                Отменить
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
