import type { Estimate, EstimateRequestLine } from '@shared/index'
import { serverRequest } from './client'

/**
 * Смета на сервере.
 *
 * Клиент присылает количества из раскроя, цены подставляет сервер из каталога
 * компании. Результат сохраняется снимком: согласованная сумма не меняется,
 * даже если материал позже подорожал.
 */

export async function createEstimate(
  projectId: string,
  lines: EstimateRequestLine[],
  markupPercent: number,
): Promise<Estimate> {
  const data = await serverRequest<{ estimate: Estimate }>(`/projects/${projectId}/estimates`, {
    method: 'POST',
    body: { lines, markupPercent },
  })
  return data.estimate
}

export async function listEstimates(projectId: string): Promise<Estimate[]> {
  const data = await serverRequest<{ estimates: Estimate[] }>(`/projects/${projectId}/estimates`)
  return data.estimates
}
