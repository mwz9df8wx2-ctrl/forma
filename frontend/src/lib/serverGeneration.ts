import type { GenerationJob, JobStatus } from '@shared/index'
import { JOB_PROGRESS } from '@shared/index'
import { fetchFileObjectUrl } from '@/api/server/billing'
import type { Generation, GenerationResult, GenerationStageId, GenerationStatus } from '@/types'

/**
 * Перевод серверного задания в модель экрана.
 *
 * Прогресс берётся из стадии задания, а не из таймера: полоса, которая ползёт
 * при мёртвом задании, обманывает пользователя и прячет сбой.
 */

const STATUS: Record<JobStatus, GenerationStatus> = {
  queued: 'queued',
  preparing: 'processing',
  generating: 'processing',
  validating: 'processing',
  saving: 'processing',
  completed: 'completed',
  failed: 'failed',
}

const STAGE: Record<JobStatus, GenerationStageId> = {
  queued: 'analyze',
  preparing: 'materials',
  generating: 'interior',
  validating: 'render',
  saving: 'render',
  completed: 'render',
  failed: 'render',
}

/**
 * Загрузка вариантов в память страницы.
 * Файлы отдаются только по токену, поэтому в <img> идёт объектная ссылка,
 * а не адрес сервера: токен не должен попадать в историю браузера.
 */
export async function loadJobResults(job: GenerationJob): Promise<GenerationResult[]> {
  // Соотношение сторон задаётся при постановке задания и одинаково у вариантов.
  const [width, height] = [1536, 1024]
  const results: GenerationResult[] = []
  for (const option of job.options) {
    if (!option.fileId) continue
    try {
      const url = await fetchFileObjectUrl(option.fileId)
      results.push({
        id: option.id,
        index: option.index + 1,
        imageUrl: url,
        thumbnailUrl: url,
        width,
        height,
        isDemo: false,
      })
    } catch {
      // Недоступный вариант пропускаем: остальные показать важнее.
    }
  }
  return results
}

export function jobToGeneration(job: GenerationJob, results: GenerationResult[] = []): Generation {
  return {
    id: job.id,
    projectId: job.projectId,
    status: STATUS[job.status],
    createdAt: job.createdAt,
    seed: 0,
    stage: STAGE[job.status],
    progress: JOB_PROGRESS[job.status],
    results,
    error:
      job.status === 'failed'
        ? {
            code: 'server',
            message: job.errorMessage ?? 'Не удалось создать визуализацию.',
          }
        : null,
    note: null,
  }
}

/** Освобождение объектных ссылок: без этого страница держит гигабайты. */
export function releaseResults(results: GenerationResult[]): void {
  for (const result of results) {
    if (result.imageUrl.startsWith('blob:')) URL.revokeObjectURL(result.imageUrl)
  }
}
