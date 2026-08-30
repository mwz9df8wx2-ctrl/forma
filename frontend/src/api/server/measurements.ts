import type { MeasurementItem, MeasurementSummary, Wallet } from '@shared/index'
import type { ServerRevision } from './projects'
import { serverRequest } from './client'

/**
 * Замеры проекта.
 *
 * Разбор текста только предлагает значения — записывает их отдельный вызов,
 * после подтверждения человеком. По этим числам режут материал, поэтому
 * автоматическая запись здесь недопустима.
 */

export interface Suggestion {
  id: string
  label: string
  value: number
  confidence: 'high' | 'medium'
  /** Фрагмент исходного текста: по нему замерщик сверяет число. */
  quote: string
  current: number | null
  currentStatus: MeasurementItem['status']
  /** Значение уже подтверждено и отличается — решает человек. */
  conflict: boolean
}

export interface MeasurementState {
  checklist: MeasurementItem[]
  summary: MeasurementSummary
}

export interface ProjectMessage {
  id: string
  role: string
  text: string
  suggestions: Suggestion[]
  source: string
  createdAt: string
}

export async function fetchMeasurements(projectId: string): Promise<MeasurementState> {
  return serverRequest<MeasurementState>(`/projects/${projectId}/measurements`)
}

export async function parseMeasurementText(
  projectId: string,
  text: string,
  useAi = false,
): Promise<MeasurementState & { suggestions: Suggestion[]; usedModel: boolean; wallet: Wallet }> {
  return serverRequest(`/projects/${projectId}/measurements/parse`, {
    method: 'POST',
    body: { text, useAi },
  })
}

export async function applyMeasurements(
  projectId: string,
  accepted: { id: string; value: number }[],
): Promise<MeasurementState & { revision: ServerRevision; createdNewRevision: boolean }> {
  return serverRequest(`/projects/${projectId}/measurements/apply`, {
    method: 'POST',
    body: { accepted },
  })
}

export async function fetchMessages(projectId: string): Promise<ProjectMessage[]> {
  const data = await serverRequest<{ messages: ProjectMessage[] }>(`/projects/${projectId}/messages`)
  return data.messages
}
