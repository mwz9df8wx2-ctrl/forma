import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createGeneration,
  createProject,
  saveProject,
  subscribeToGeneration,
  uploadProjectPhoto,
} from '@/api'
import { getProject, saveSpec } from '@/api/server/projects'
import { enqueueGeneration, watchJob, type JobWatcher } from '@/api/server/billing'
import { uploadFile } from '@/api/server/projects'
import { analyzePhoto } from '@/analysis/analyze'
import { eraseFurniture } from '@/analysis/erase'
import { buildReplacementMask, decodePhoto } from '@/lib/maskImage'
import { jobToGeneration, loadJobResults, releaseResults } from '@/lib/serverGeneration'
import { useBilling } from '@/hooks/useBilling'
import { paramsToSpec, specToParams } from '@/lib/specMapping'
import { useToast } from '@/hooks/useToast'
import { nearestByHex } from '@/lib/color'
import { formatDate } from '@/lib/format'
import { readStorage, removeStorage, writeStorage } from '@/lib/storage'
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

/**
 * Открытый серверный проект переживает перезагрузку страницы.
 * Иначе переход по прямой ссылке — на замеры, чертежи — терял бы проект,
 * и замерщик на объекте начинал бы заново.
 */
const OPEN_PROJECT_KEY = 'forma.project.v1'

interface OpenProject {
  id: string
  revisionId: string | null
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { catalog } = useCatalog()
  const { showError, show } = useToast()
  const { serverGeneration, refresh: refreshWallet } = useBilling()

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
  const [serverProject, setServerProjectState] = useState<OpenProject | null>(() =>
    readStorage<OpenProject | null>(OPEN_PROJECT_KEY, null),
  )

  const setServerProject = useCallback((value: OpenProject | null) => {
    setServerProjectState(value)
    if (value) writeStorage(OPEN_PROJECT_KEY, value)
    else removeStorage(OPEN_PROJECT_KEY)
  }, [])
  // Зерно расчёта: сохраняется между запусками, меняется только по команде.
  // Значение берём лениво, чтобы не вызывать Math.random во время рендера.
  const seed = useRef<number | null>(null)
  const nextSeed = () => Math.floor(Math.random() * 100000)
  const currentSeed = () => {
    if (seed.current === null) seed.current = nextSeed()
    return seed.current
  }

  const subscription = useRef<GenerationSubscription | null>(null)
  const serverWatcher = useRef<JobWatcher | null>(null)
  // Защита от двойного нажатия: состояние обновится позже, ссылка — сразу.
  const starting = useRef(false)

  const stopWatching = useCallback(() => {
    subscription.current?.close()
    subscription.current = null
    serverWatcher.current?.close()
    serverWatcher.current = null
  }, [])

  useEffect(() => () => stopWatching(), [stopWatching])

  /**
   * Восстановление проекта после перезагрузки страницы.
   *
   * Параметры живут в памяти вкладки, а источник правды — на сервере.
   * Без этого переход по прямой ссылке на чертежи или техпакет открывал бы
   * пустой проект, хотя спецификация давно сохранена.
   */
  const restoring = useRef<string | null>(null)
  useEffect(() => {
    const target = serverProject?.id ?? null
    // Проект уже открыт в этой вкладке — восстанавливать нечего.
    if (!target || project || restoring.current === target) return
    restoring.current = target

    // Ответ не отменяется по размонтированию эффекта: в режиме строгой
    // проверки React монтирует его дважды, и отмена оставила бы проект пустым.
    void getProject(target)
      .then(({ project: remote, revision }) => {
        // Пользователь мог переключить проект, пока шёл запрос.
        if (restoring.current !== target || !revision) return
        setTitle(remote.title)
        setParams((current) => specToParams(revision.spec, current))
      })
      .catch(() => {
        // Проект мог быть удалён на другом устройстве — дадим попробовать снова.
        restoring.current = null
      })
  }, [serverProject, project])

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
    stopWatching()
    setGeneration((previous) => {
      if (previous) releaseResults(previous.results)
      return null
    })
  }, [stopWatching])

  /**
   * Подготовка снимка к замене мебели у провайдера.
   *
   * Провайдеру нужны две вещи: сам кадр и маска области, которую разрешено
   * перерисовать. Маску считаем тем же кодом, что снимает прежнюю мебель
   * локально, — иначе с ключом и без ключа менялись бы разные области.
   */
  const prepareReplacement = useCallback(
    async (projectId: string): Promise<{ referenceFileId: string; maskFileId: string | null } | null> => {
      if (!photo) return null
      try {
        const decoded = await decodePhoto(photo.dataUrl)
        if (!decoded) return null

        const response = await fetch(photo.dataUrl)
        const photoBlob = await response.blob()
        const uploaded = await uploadFile(projectId, photoBlob, 'room_photo')

        const analysis = analyzePhoto(decoded.pixels, decoded.width, decoded.height)
        const plate = eraseFurniture(decoded.pixels, decoded.width, decoded.height, analysis)
        if (!plate.reliable) {
          // Границы прежней мебели не определились. Отправляем снимок без
          // маски: пусть провайдер решает сам, это честнее выдуманной области.
          return { referenceFileId: uploaded.id, maskFileId: null }
        }

        const maskBlob = await buildReplacementMask(plate.mask, decoded.width, decoded.height)
        if (!maskBlob) return { referenceFileId: uploaded.id, maskFileId: null }
        const maskFile = await uploadFile(projectId, maskBlob, 'reference')
        return { referenceFileId: uploaded.id, maskFileId: maskFile.id }
      } catch (error) {
        // Подготовка снимка не должна ронять запуск: без неё кухня просто
        // будет нарисована с нуля.
        showError(error)
        return null
      }
    },
    [photo, showError],
  )

  /**
   * Запуск на сервере.
   *
   * Сервер резервирует кредиты, ставит задание в очередь и отдаёт его
   * идентификатор. Экран следит за настоящими стадиями задания: пока сервер
   * не сообщил о переходе, полоса не двигается.
   */
  const runServerJob = useCallback(
    async (projectId: string) => {
      stopWatching()
      try {
        const replacement = await prepareReplacement(projectId)
        const { job, reused } = await enqueueGeneration({
          projectId,
          quality: 'preview',
          variants: 3,
          seed: currentSeed(),
          referenceFileId: replacement?.referenceFileId ?? null,
          maskFileId: replacement?.maskFileId ?? null,
          // Ключ идемпотентности: повтор того же запроса не создаёт второе
          // платное задание, даже если браузер отправил его дважды.
          idempotencyKey: crypto.randomUUID(),
        })
        setGeneration(jobToGeneration(job))
        void refreshWallet()
        if (reused) {
          show({ title: 'Расчёт уже запущен', variant: 'info' })
        }

        serverWatcher.current = watchJob(
          job.id,
          (fresh) => {
            if (fresh.status === 'completed') {
              void loadJobResults(fresh).then((results) => {
                setGeneration(jobToGeneration(fresh, results))
                void refreshWallet()
                const preview = results[0]?.thumbnailUrl ?? null
                setProject((previous) =>
                  previous
                    ? {
                        ...previous,
                        previewUrl: preview,
                        summary: catalog ? buildSummary(catalog, params) : previous.summary,
                        generationsCount: previous.generationsCount + 1,
                        updatedAt: new Date().toISOString(),
                      }
                    : previous,
                )
              })
              return
            }

            setGeneration(jobToGeneration(fresh))
            if (fresh.status === 'failed') {
              void refreshWallet()
              // Возврат кредитов сообщаем прямо: иначе пользователь считает,
              // что заплатил за неудачу.
              show({
                title: fresh.errorMessage ?? 'Не удалось создать визуализацию.',
                description: 'AI-кредиты возвращены.',
                variant: 'error',
              })
            }
          },
          (error) => {
            showError(error)
          },
        )
        return true
      } catch (error) {
        showError(error)
        setGeneration(null)
        return false
      }
    },
    [stopWatching, prepareReplacement, refreshWallet, show, showError, catalog, params],
  )

  const startGeneration = useCallback(async (options?: { newSeed?: boolean }) => {
    if (missingParams(params).length > 0) return false
    // Двойное нажатие не должно ставить два задания: состояние обновится
    // позже, а ссылка — прямо сейчас.
    if (starting.current) return false
    starting.current = true
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
        starting.current = false
        return false
      }
    }

    // Настоящая генерация живёт на сервере: там кредиты, лимиты и очередь.
    // Без подключённого провайдера считаем на устройстве — так результат
    // лучше, чем заглушка, и деньги не тратятся.
    if (serverProject && serverGeneration) {
      const started = await runServerJob(serverProject.id)
      starting.current = false
      return started
    }

    stopWatching()

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

      starting.current = false
      return true
    } catch (error) {
      showError(error)
      setGeneration(null)
      starting.current = false
      return false
    }
  }, [
    params,
    project,
    serverProject,
    setServerProject,
    serverGeneration,
    runServerJob,
    stopWatching,
    title,
    photo,
    catalog,
    show,
    showError,
  ])

  const openProject = useCallback((next: Project) => {
    stopWatching()
    setProject(next)
    setPhoto(next.photo)
    setParams(next.params)
    setTitle(next.title)
    setGeneration(null)
  }, [stopWatching])

  const resetProject = useCallback(() => {
    stopWatching()
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
  }, [stopWatching, setServerProject])

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
      setServerProject,
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
