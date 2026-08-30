import { dataUrlToBlob } from '@/lib/image'
import type { Project, ProjectParams, ProjectPhoto } from '@/types'
import { request } from './client'
import { USE_MOCK_API } from './config'
import { mockBackend } from './mockBackend'

export async function createProject(title: string, params: ProjectParams): Promise<Project> {
  if (USE_MOCK_API) return mockBackend.createProject(title, params)
  return request<Project>('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, params }),
  })
}

/** POST /projects/{projectId}/photo — фотография уходит сразу после подтверждения. */
export async function uploadProjectPhoto(
  projectId: string,
  photo: ProjectPhoto,
): Promise<{ photoId: string }> {
  if (USE_MOCK_API) return mockBackend.uploadPhoto(projectId, photo)

  const blob = await dataUrlToBlob(photo.dataUrl)
  const form = new FormData()
  form.append('photo', blob, photo.fileName)
  form.append('width', String(photo.width))
  form.append('height', String(photo.height))

  return request<{ photoId: string }>(`/projects/${projectId}/photo`, {
    method: 'POST',
    body: form,
  })
}

export async function listProjects(): Promise<Project[]> {
  if (USE_MOCK_API) return mockBackend.listProjects()
  return request<Project[]>('/projects')
}

export async function getProject(id: string): Promise<Project | null> {
  if (USE_MOCK_API) return mockBackend.getProject(id)
  return request<Project>(`/projects/${id}`)
}

export async function saveProject(project: Project): Promise<Project> {
  if (USE_MOCK_API) return mockBackend.saveProject(project)
  return request<Project>(`/projects/${project.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: project.title, params: project.params }),
  })
}

export async function deleteProject(id: string): Promise<void> {
  if (USE_MOCK_API) return mockBackend.deleteProject(id)
  await request<void>(`/projects/${id}`, { method: 'DELETE' })
}
