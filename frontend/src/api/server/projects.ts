import type { ProjectSpec } from '@shared/index'
import { serverRequest } from './client'

/** Проекты и ревизии на сервере. */

export interface ServerProject {
  id: string
  title: string
  category: string
  status: string
  clientName: string | null
  currentRevisionId: string | null
  selectedRevisionId: string | null
  createdAt: string
  updatedAt: string
}

export interface ServerRevision {
  id: string
  projectId: string
  revisionNumber: number
  parentRevisionId: string | null
  source: string
  locked: boolean
  approvalStatus: string
  createdAt: string
  spec: ProjectSpec
  readiness: { ready: boolean; missing: string[] }
}

export async function listProjects(): Promise<ServerProject[]> {
  const data = await serverRequest<{ projects: ServerProject[] }>('/projects')
  return data.projects
}

export async function createProject(input: {
  title: string
  category?: string
  clientName?: string
}): Promise<{ project: ServerProject; revision: ServerRevision }> {
  return serverRequest('/projects', { method: 'POST', body: input })
}

export async function getProject(
  id: string,
): Promise<{ project: ServerProject; revision: ServerRevision | null }> {
  return serverRequest(`/projects/${id}`)
}

export async function listRevisions(projectId: string): Promise<ServerRevision[]> {
  const data = await serverRequest<{ revisions: ServerRevision[] }>(
    `/projects/${projectId}/revisions`,
  )
  return data.revisions
}

/**
 * Сохранение спецификации.
 * Сервер сам решает, править черновую ревизию или создать новую:
 * согласованную изменить нельзя.
 */
export async function saveSpec(
  projectId: string,
  spec: ProjectSpec,
  source: 'manual' | 'chat' | 'ocr' | 'vision' = 'manual',
): Promise<{ revision: ServerRevision; createdNewRevision: boolean }> {
  return serverRequest(`/projects/${projectId}/spec`, {
    method: 'POST',
    body: { spec, source },
  })
}

export async function approveRevision(
  projectId: string,
  revisionId: string,
  input: { optionId?: string | null; clientName?: string; note?: string } = {},
): Promise<{ revision: ServerRevision }> {
  return serverRequest(`/projects/${projectId}/revisions/${revisionId}/approve`, {
    method: 'POST',
    body: input,
  })
}

export async function archiveProject(id: string): Promise<void> {
  await serverRequest(`/projects/${id}`, { method: 'DELETE' })
}

export interface ServerFile {
  id: string
  kind: string
  mime: string
  sizeBytes: number
  url: string
}

/** Загрузка снимка. Файл уходит на сервер, а не остаётся в браузере. */
export async function uploadFile(
  projectId: string,
  blob: Blob,
  kind = 'room_photo',
): Promise<ServerFile> {
  const data = await serverRequest<{ file: ServerFile }>(`/projects/${projectId}/files`, {
    method: 'POST',
    raw: blob,
    headers: { 'X-File-Kind': kind, 'Content-Type': blob.type || 'application/octet-stream' },
  })
  return data.file
}
