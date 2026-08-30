import { useMemo } from 'react'
import { GENERATION_STAGES, generationStages } from '@/mock/catalog'
import { useProject } from './useProject'

/**
 * Представление хода генерации для UI: текущий этап,
 * список пройденных шагов и признак незавершённости.
 */
export function useGeneration() {
  const { generation, results, params, startGeneration, cancelGeneration } = useProject()

  const stages = useMemo(() => generationStages(params.category), [params.category])

  const stageIndex = useMemo(() => {
    if (!generation?.stage) return 0
    const index = GENERATION_STAGES.findIndex((stage) => stage.id === generation.stage)
    return index < 0 ? 0 : index
  }, [generation])

  const isRunning = generation?.status === 'queued' || generation?.status === 'processing'

  return {
    generation,
    results,
    stages,
    stageIndex,
    isRunning,
    isCompleted: generation?.status === 'completed',
    isFailed: generation?.status === 'failed',
    progress: generation?.progress ?? null,
    startGeneration,
    cancelGeneration,
  }
}
