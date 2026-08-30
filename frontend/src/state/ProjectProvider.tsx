import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createGeneration,
  createProject,
  saveProject,
  subscribeToGeneration,
  uploadProjectPhoto,
} from '@/api'
import { saveSpec } from '@/api/server/projects'
import { paramsToSpec } from '@/lib/specMapping'
import { useToast } from '@/hooks/useToast'
import { nearestByHex } from '@/lib/color'
import { formatDate } from '@/lib/format'
import { buildGenerationPayload, missingParams } from '@/lib/payload'
import { buildSummary } from '@/lib/summary'
import { DEFAULT_PARAMS } from '@/mock/catalog'
import { useCatalog } from '@/hooks/useCatalog'
import type {
  Dimensions,
  Generation,
  GenerationSubscription,
  Project,
  ProjectParams,
  ProjectPhoto,
} from '@/types'
import { ProjectContext } from './project'

function defaultTitle(): string {
  return `Кухня — ${formatDate(new Date().toISOString())}`
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { catalog } = useCatalog()
  const { showError, show } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [photo, setPhoto] = useState<ProjectPhoto | null>(null)
  const [params, setParams] = useState<ProjectParams>(() => ({
    ...DEFAULT_PARAMS,
    dimensions: { ...DEFAULT_PARAMS.dimensions },
    options: { ...DEFAULT_PARAMS.options },
  }))
  const [title, setTitle] = useState(defaultTitle)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [generation, setGeneration] = useState<Generation | null>(null)
  const [serverProject, setServerProject] = useState<{ id: string; revisionId: string | null } | null>(
    null,
  )
  // Зерно расчёта: сохраняется между запусками, меняется только по команде.
  // Значение берём лениво, чтобы не вызывать Math.random во время рендера.
  const seed = useRef<number | null>(null)
  const nextSeed = () => Math.floor(Math.random() * 100000)
  const currentSeed = () => {
    if (seed.current === null) seed.current = nextSeed()
    return seed.current
  }

  const subscription = useRef<GenerationSubscription | null>(null)

  useEffect(() => () => subscription.current?.close(), [])

  const confirmPhoto = useCallback(
    async (nextPhoto: ProjectPhoto) => {
      setPhoto(nextPhoto)
      setPhotoUploading(true)
      try {
        let current = project
        if (!current) {
          current = await createProject(title, params)
          setProject(current)
        }
        // Фотография уходит на бэкенд сразу после подтверждения.
        await uploadProjectPhoto(current.id, nextPhoto)
        setProject({ ...current, photo: nextPhoto })
      } catch (error) {
        // Снимок остаётся на устройстве — сценарий не прерывается.
        showError(error)
      } finally {
        setPhotoUploading(false)
      }
    },
    [project, title, params, showError],
  )

  const clearPhoto = useCallback(() => setPhoto(null), [])

  const updateParams = useCallback((patch: Partial<ProjectParams>) => {
    setParams((current) => ({ ...current, ...patch }))
  }, [])

  const setDimension = useCallback((key: keyof Dimensions, value: number) => {
    setParams((current) => ({ ...current, dimensions: { ...current.dimensions, [key]: value } }))
  }, [])

  const toggleOption = useCallback((id: string, value: boolean) => {
    setParams((current) => ({ ...current, options: { ...current.options, [id]: value } }))
  }, [])

  /** Выбор палитры подсказывает цвет фасадов, если он ещё не выбран вручную. */
  const selectPalette = useCallback(
    (paletteId: string) => {
      setParams((current) => {
        if (current.colorId || !catalog) return { ...current, paletteId }
        const palette = catalog.palettes.find((item) => item.id === paletteId)
        const dominant = palette?.swatches[0]?.hex
        const suggested = dominant ? nearestByHex(catalog.colors, dominant) : undefined
        return { ...current, paletteId, colorId: suggested?.id ?? current.colorId }
      })
    },
    [catalog],
  )

  const cancelGeneration = useCallback(() => {
    subscription.current?.close()
    subscription.current = null
    setGeneration(null)
  }, [])

  const startGeneration = useCallback(async (options?: { newSeed?: boolean }) => {
    if (missingParams(params).length > 0) return false
    if (options?.newSeed) seed.current = nextSeed()

    // Спецификация уходит на сервер до расчёта: источник правды там, а не в
    // браузере. Сервер сам решит, править черновик или создать новую ревизию.
    if (serverProject) {
      try {
        const saved = await saveSpec(serverProject.id, paramsToSpec(params))
        setServerProject({ id: serverProject.id, revisionId: saved.revision.id })
        if (saved.createdNewRevision) {
          show({
            title: `Создана ревизия ${saved.revision.revisionNumber}`,
            description: 'Согласованный вариант остался без изменений.',
            variant: 'info',
          })
        }
      } catch (error) {
        showError(error)
        return false
      }
    }

    subscription.current?.close()
    subscription.current = null

    try {
      let current = project
      if (!current) {
        current = await createProject(title, params)
        setProject(current)
      }

      const created = await createGeneration(
        current.id,
        buildGenerationPayload(params),
        photo,
        currentSeed(),
      )
      setGeneration(created)

      const projectId = current.id
      subscription.current = subscribeToGeneration(created.id, (event) => {
        setGeneration((previous) => {
          const base = previous ?? created
          return {
            ...base,
            status: event.status,
            stage: event.stage !== undefined ? event.stage : base.stage,
            progress: event.progress !== undefined ? event.progress : base.progress,
            results: event.results && event.results.length > 0 ? event.results : base.results,
            note: event.note ?? base.note ?? null,
            error: event.error ?? null,
          }
        })

        if (event.status === 'failed') {
          show({ title: event.error?.message ?? 'Не удалось создать визуализацию. Попробуйте ещё раз.', variant: 'error' })
        }

        if (event.status === 'completed' && event.results && event.results.length > 0) {
          const preview = event.results[0].thumbnailUrl
          setProject((previous) => {
            const base: Project = previous ?? {
              id: projectId,
              title,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              photo,
              params,
              previewUrl: null,
              summary: '',
              generationsCount: 0,
            }
            const updated: Project = {
              ...base,
              photo: photo ?? base.photo,
              params,
              previewUrl: preview,
              summary: catalog ? buildSummary(catalog, params) : base.summary,
              generationsCount: base.generationsCount + 1,
              updatedAt: new Date().toISOString(),
            }
            void saveProject(updated).catch(() => {
              /* проект остаётся в памяти сессии, сценарий не прерываем */
            })
            return updated
          })
        }
      })

      return true
    } catch (error) {
      showError(error)
      setGeneration(null)
      return false
    }
  }, [params, project, serverProject, title, photo, catalog, show, showError])

  const openProject = useCallback((next: Project) => {
    subscription.current?.close()
    subscription.current = null
    setProject(next)
    setPhoto(next.photo)
    setParams(next.params)
    setTitle(next.title)
    setGeneration(null)
  }, [])

  const resetProject = useCallback(() => {
    subscription.current?.close()
    subscription.current = null
    setProject(null)
    setServerProject(null)
    setPhoto(null)
    setGeneration(null)
    setTitle(defaultTitle())
    setParams({
      ...DEFAULT_PARAMS,
      dimensions: { ...DEFAULT_PARAMS.dimensions },
      options: { ...DEFAULT_PARAMS.options },
    })
  }, [])

  const missing = useMemo(() => missingParams(params), [params])

  const value = useMemo(
    () => ({
      project,
      photo,
      params,
      title,
      photoUploading,
      generation,
      results: generation?.results ?? [],
      missing,
      // Фотография необязательна: без неё сцена строится по размерам.
      canGenerate: missing.length === 0,
      serverProject,
      setServerProject,
      setTitle,
      confirmPhoto,
      clearPhoto,
      updateParams,
      setDimension,
      toggleOption,
      selectPalette,
      startGeneration,
      cancelGeneration,
      openProject,
      resetProject,
    }),
    [
      project,
      serverProject,
      photo,
      params,
      title,
      photoUploading,
      generation,
      missing,
      confirmPhoto,
      clearPhoto,
      updateParams,
      setDimension,
      toggleOption,
      selectPalette,
      startGeneration,
      cancelGeneration,
      openProject,
      resetProject,
    ],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
