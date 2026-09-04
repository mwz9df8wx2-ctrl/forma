import type {
  BudgetLimits,
  CreditCosts,
  GenerationJob,
  GenerationQuality,
  UsageTransaction,
  Wallet,
} from '@shared/index'
import { serverRequest, SERVER_URL, loadSession } from './client'

/**
 * Кредиты и задания генерации на сервере.
 *
 * Всё, что связано с деньгами, считает сервер. Здесь только чтение состояния
 * и постановка задания: подделать баланс из браузера нельзя.
 */

export interface WalletState {
  wallet: Wallet
  costs: CreditCosts
  limits: Pick<BudgetLimits, 'maxVariantsPerJob' | 'maxConcurrentJobsPerCompany'>
  usage: { userMonth: number; companyMonth: number; globalDay: number; globalMonth: number }
}

export async function fetchWallet(): Promise<WalletState> {
  return serverRequest<WalletState>('/billing/wallet')
}

export async function fetchTransactions(): Promise<UsageTransaction[]> {
  const data = await serverRequest<{ transactions: UsageTransaction[] }>('/billing/transactions')
  return data.transactions
}

export interface EnqueueInput {
  projectId: string
  quality: GenerationQuality
  variants: number
  size?: '1024x1024' | '1536x1024' | '1024x1536'
  seed?: number
  notes?: string
  referenceFileId?: string | null
  /** Маска замены: прозрачные пиксели PNG — область, которую перерисуют. */
  maskFileId?: string | null
  /** Ключ идемпотентности: повтор запроса не должен стоить вторых денег. */
  idempotencyKey: string
}

export async function enqueueGeneration(
  input: EnqueueInput,
): Promise<{ job: GenerationJob; reused: boolean; wallet: Wallet; cost: number }> {
  return serverRequest(`/projects/${input.projectId}/generations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: {
      quality: input.quality,
      variants: input.variants,
      size: input.size ?? '1536x1024',
      seed: input.seed ?? 0,
      notes: input.notes ?? '',
      referenceFileId: input.referenceFileId ?? null,
      maskFileId: input.maskFileId ?? null,
    },
  })
}

export async function fetchJob(jobId: string): Promise<{ job: GenerationJob; progress: number; wallet: Wallet }> {
  return serverRequest(`/generations/${jobId}`)
}

export async function selectOption(jobId: string, optionId: string): Promise<GenerationJob> {
  const data = await serverRequest<{ job: GenerationJob }>(`/generations/${jobId}/select`, {
    method: 'POST',
    body: { optionId },
  })
  return data.job
}

/**
 * Загрузка результата в память страницы.
 *
 * Прямая ссылка в <img> не подойдёт: файл отдаётся только по токену,
 * а токен в адресе — это токен в истории браузера и в логах прокси.
 */
export async function fetchFileObjectUrl(fileId: string): Promise<string> {
  const session = loadSession()
  const response = await fetch(`${SERVER_URL}/files/${fileId}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  })
  if (!response.ok) throw new Error('Файл недоступен')
  return URL.createObjectURL(await response.blob())
}

export interface JobWatcher {
  close: () => void
}

/**
 * Наблюдение за заданием.
 *
 * Опрос, а не EventSource: поток событий требует токен в заголовке,
 * которого EventSource не умеет, а токен в адресе оседает в логах.
 * Интервал растёт, пока задание стоит в очереди, — сервер не должен
 * отвечать на пустые запросы чаще, чем происходит что-то новое.
 */
export function watchJob(
  jobId: string,
  onUpdate: (job: GenerationJob, progress: number, wallet: Wallet) => void,
  onError: (error: unknown) => void,
): JobWatcher {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let delay = 700

  const tick = async () => {
    if (stopped) return
    try {
      const data = await fetchJob(jobId)
      if (stopped) return
      onUpdate(data.job, data.progress, data.wallet)
      if (data.job.status === 'completed' || data.job.status === 'failed') return
      delay = data.job.status === 'queued' ? Math.min(delay * 1.4, 4000) : 700
    } catch (error) {
      if (stopped) return
      onError(error)
      return
    }
    timer = setTimeout(tick, delay)
  }

  void tick()

  return {
    close: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}
