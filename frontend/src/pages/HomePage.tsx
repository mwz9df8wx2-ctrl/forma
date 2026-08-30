import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, Images, LoaderCircle } from 'lucide-react'
import { CameraView } from '@/components/camera/CameraView'
import { PhotoConfirm } from '@/components/camera/PhotoConfirm'
import { PhotoDropzone } from '@/components/camera/PhotoDropzone'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { useProject } from '@/hooks/useProject'
import { useProjects } from '@/hooks/useProjects'
import { useToast } from '@/hooks/useToast'
import { isCameraSupported } from '@/hooks/useCamera'
import { formatDate } from '@/lib/format'
import { prepareProjectPhoto } from '@/lib/image'
import { HERO_PREVIEW_URL } from '@/mock/hero'
import type { ProjectPhoto } from '@/types'

type Mode = 'idle' | 'camera' | 'confirm'

const STEPS = [
  {
    title: 'Снимок',
    text: 'Встаньте напротив кухни и снимите стену целиком, фронтально — тогда новая кухня встанет прямо в ваш кадр.',
  },
  { title: 'Параметры', text: 'Материал, цвет, палитра, стиль, свет и размеры.' },
  { title: 'Визуализация', text: 'Покажите клиенту результат на экране телефона.' },
]

export function HomePage() {
  const navigate = useNavigate()
  const { confirmPhoto, photoUploading, resetProject, openProject } = useProject()
  const { projects } = useProjects()
  const { showError } = useToast()

  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState<ProjectPhoto | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [cameFromCamera, setCameFromCamera] = useState(false)

  const galleryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File, fromCamera: boolean) => {
    setPreparing(true)
    try {
      const photo = await prepareProjectPhoto(file)
      setDraft(photo)
      setCameFromCamera(fromCamera)
      setMode('confirm')
    } catch (error) {
      showError(error)
      setMode('idle')
    } finally {
      setPreparing(false)
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>, fromCamera: boolean) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void handleFile(file, fromCamera)
  }

  const startCamera = () => {
    resetProject()
    if (isCameraSupported()) setMode('camera')
    else cameraInput.current?.click()
  }

  const pickFromGallery = () => {
    resetProject()
    galleryInput.current?.click()
  }

  const handleConfirm = async () => {
    if (!draft) return
    await confirmPhoto(draft)
    setMode('idle')
    setDraft(null)
    navigate('/setup')
  }

  const recent = projects.slice(0, 3)

  return (
    <>
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => handleInputChange(event, false)}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => handleInputChange(event, true)}
      />

      <PageHeader
        showLogo
        title="Новая визуализация"
        subtitle="Создайте визуализацию кухни прямо на замере — по одной фотографии."
      />

      <div className="px-5 pt-8 pb-10 lg:px-10 lg:pt-8 lg:pb-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0">
            <PhotoDropzone onFile={(file) => void handleFile(file, false)}>
              <div className="flex flex-col gap-2.5">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={preparing ? undefined : <Camera />}
                  loading={preparing}
                  onClick={startCamera}
                >
                  Сфотографировать кухню
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  icon={<Images />}
                  disabled={preparing}
                  onClick={pickFromGallery}
                >
                  Выбрать из галереи
                </Button>
                <p className="mt-1 hidden text-center text-xs text-faint lg:block">
                  Или перетащите фотографию в это окно
                </p>
              </div>
            </PhotoDropzone>

            <ol className="mt-9 space-y-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[0.6875rem] font-semibold text-muted"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] leading-tight font-medium text-ink">
                      {step.title}
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="min-w-0">
            <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <img
                src={HERO_PREVIEW_URL}
                alt="Пример визуализации кухни: шпон дуба, светлая кварцевая столешница, тёплый рассеянный свет"
                className="aspect-[3/2] w-full object-cover"
              />
              <figcaption className="flex flex-col gap-0.5 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-[0.8125rem] text-muted">Пример визуализации</span>
                <span className="truncate text-[0.8125rem] font-medium text-ink">
                  Шпон · Натуральный дуб · Japandi
                </span>
              </figcaption>
            </figure>

            {recent.length > 0 && (
              <section aria-labelledby="recent-title" className="mt-9">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 id="recent-title" className="eyebrow">
                    Недавние проекты
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate('/projects')}
                    className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-medium text-graphite transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    Все проекты
                    <ArrowRight aria-hidden className="size-3.5" />
                  </button>
                </div>

                <ul className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
                  {recent.map((project) => (
                    <li key={project.id} className="w-[62%] shrink-0 sm:w-[42%] lg:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          openProject(project)
                          navigate('/setup')
                        }}
                        className="group w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card"
                      >
                        <span className="block aspect-[3/2] w-full overflow-hidden bg-surface-3">
                          {project.previewUrl && (
                            <img
                              src={project.previewUrl}
                              alt=""
                              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                          )}
                        </span>
                        <span className="block px-3 py-2.5">
                          <span className="block truncate text-[0.8125rem] font-medium text-ink">
                            {project.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-faint">
                            {formatDate(project.updatedAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>

      {mode === 'camera' && (
        <CameraView
          onCapture={(file) => void handleFile(file, true)}
          onCancel={() => setMode('idle')}
          onPickFromGallery={() => {
            setMode('idle')
            galleryInput.current?.click()
          }}
        />
      )}

      {mode === 'confirm' && draft && (
        <PhotoConfirm
          photo={draft}
          busy={photoUploading}
          onRetake={() => {
            setDraft(null)
            if (cameFromCamera && isCameraSupported()) setMode('camera')
            else {
              setMode('idle')
              if (cameFromCamera) cameraInput.current?.click()
              else galleryInput.current?.click()
            }
          }}
          onConfirm={() => void handleConfirm()}
        />
      )}

      {preparing && mode !== 'confirm' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 shadow-lift">
            <LoaderCircle aria-hidden className="size-4 animate-spin text-clay" />
            <p className="text-[0.875rem] font-medium text-ink">Готовим фотографию…</p>
          </div>
        </div>
      )}
    </>
  )
}
