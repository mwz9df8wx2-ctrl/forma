import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Info, ListFilter, RefreshCw, Ruler, SlidersHorizontal } from 'lucide-react'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { GenerationResults } from '@/components/generation/GenerationResults'
import { ImageViewer } from '@/components/generation/ImageViewer'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Dialog'
import { preparePhotoPixels, qualityProfile, renderVariant } from '@/mock/visualization'
import { useCatalog } from '@/hooks/useCatalog'
import { useProject } from '@/hooks/useProject'
import { useToast } from '@/hooks/useToast'
import { downloadImage, shareImage } from '@/lib/image'
import { describeOptions, describeSelection } from '@/lib/summary'
import type { GenerationResult } from '@/types'

export function ResultsPage() {
  const navigate = useNavigate()
  const { catalog } = useCatalog()
  const { photo, params, title, results, generation, startGeneration } = useProject()
  const { show, showError } = useToast()

  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [highResId, setHighResId] = useState<string | null>(null)

  useEffect(() => {
    if (results.length === 0) navigate(photo ? '/setup' : '/', { replace: true })
  }, [results.length, photo, navigate])

  if (results.length === 0) return null

  const selection = catalog ? describeSelection(catalog, params) : []
  const activeOptions = catalog ? describeOptions(catalog, params) : []

  const handleDownload = async (result: GenerationResult) => {
    setDownloadingId(result.id)
    try {
      await downloadImage(result.imageUrl, `forma-вариант-${result.index}.jpg`)
      show({ title: 'Изображение сохранено', variant: 'success' })
    } catch (error) {
      showError(error)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleShare = async (result: GenerationResult) => {
    const shared = await shareImage(
      result.imageUrl,
      `forma-вариант-${result.index}.jpg`,
      `${title} — вариант ${result.index}`,
    )
    if (!shared) await handleDownload(result)
  }

  // «Создать ещё» и «Создать похожий» не меняют параметры — только зерно.
  /**
   * Пересчёт выбранного варианта в большом разрешении.
   * Три превью считаются быстро; тяжёлый кадр — только по запросу.
   */
  const handleHighRes = async (result: GenerationResult) => {
    if (!catalog) return
    setHighResId(result.id)
    show({
      title: 'Готовим файл в высоком разрешении',
      description: 'Расчёт занимает до минуты — окно можно не закрывать.',
      variant: 'info',
    })
    try {
      const profile = { ...qualityProfile('quality'), width: 1600, aoSamples: 4 }
      const prepared = photo ? await preparePhotoPixels(photo.dataUrl, profile.width) : null
      const handle = renderVariant({
        catalog,
        params,
        variant: result.index - 1,
        seed: generation?.seed ?? 1,
        profile,
        dimensions: params.dimensions,
        photo: prepared,
      })
      const rendered = await handle.promise
      await downloadImage(rendered.dataUrl, `forma-вариант-${result.index}-${rendered.width}px.jpg`)
      show({ title: `Сохранено ${rendered.width}×${rendered.height}`, variant: 'success' })
    } catch (error) {
      showError(error)
    } finally {
      setHighResId(null)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    const started = await startGeneration({ newSeed: true })
    setRegenerating(false)
    if (started) navigate('/generation')
  }

  const viewerResult = viewerIndex !== null ? results[viewerIndex] : null

  return (
    <>
      <FlowHeader
        title={title}
        subtitle="Результат"
        onBack={() => navigate('/setup')}
        backLabel="Вернуться к параметрам"
        action={
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              icon={<ListFilter />}
              onClick={() => setDetailsOpen(true)}
            >
              Детали
            </Button>
          </div>
        }
      />

      <div className="px-5 pt-7 pb-12 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.025em] text-ink lg:text-[2rem]">
                Готово
              </h1>
              <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-muted">
                {results.length === 1
                  ? 'Визуализация готова. Откройте её на весь экран и покажите клиенту.'
                  : `Готово ${results.length} варианта. Откройте нужный на весь экран и покажите клиенту.`}
              </p>
            </div>

            <div className="hidden gap-2.5 lg:flex">
              <Button
                variant="secondary"
                size="md"
                icon={<Ruler />}
                onClick={() => navigate('/drawings')}
              >
                Чертежи
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<SlidersHorizontal />}
                onClick={() => navigate('/setup')}
              >
                Изменить параметры
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<RefreshCw />}
                loading={regenerating}
                onClick={() => void handleRegenerate()}
              >
                Создать ещё
              </Button>
            </div>
          </div>

          {generation?.note && (
            <div className="mt-6 flex gap-3 rounded-xl border border-clay/20 bg-clay-soft p-4">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
              <div className="min-w-0">
                <p className="text-[0.875rem] leading-snug font-medium text-ink">
                  Кухню не вписали в вашу фотографию
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-graphite">
                  Причина: {generation.note}. Показана отдельная визуализация с выбранными
                  материалами. Чтобы кухня встала прямо в снимок, встаньте напротив неё,
                  держите телефон ровно и снимите стену целиком — от пола до потолка.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  icon={<Camera />}
                  onClick={() => navigate('/')}
                >
                  Переснять
                </Button>
              </div>
            </div>
          )}

          <div className="mt-7">
            <GenerationResults
              results={results}
              downloadingId={downloadingId}
              onOpen={(index) => setViewerIndex(index)}
              onDownload={(result) => void handleDownload(result)}
              onSimilar={() => void handleRegenerate()}
              onHighRes={(result) => void handleHighRes(result)}
              highResId={highResId}
            />
          </div>

          <div className="mt-8 flex flex-col gap-2.5 lg:hidden">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              icon={<Ruler />}
              onClick={() => navigate('/drawings')}
            >
              Чертежи и спецификация
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              icon={<SlidersHorizontal />}
              onClick={() => navigate('/setup')}
            >
              Изменить параметры
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<RefreshCw />}
              loading={regenerating}
              onClick={() => void handleRegenerate()}
            >
              Создать ещё
            </Button>
          </div>

          <section
            aria-labelledby="summary-title"
            className="mt-10 hidden rounded-2xl border border-line bg-surface p-6 lg:block"
          >
            <h2 id="summary-title" className="eyebrow mb-4">
              Параметры проекта
            </h2>
            <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {selection.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-[0.8125rem] text-muted">{row.label}</span>
                  <span className="truncate text-right text-[0.8125rem] font-medium text-ink">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {activeOptions.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                {activeOptions.map((option) => (
                  <span
                    key={option}
                    className="rounded-md bg-surface-3 px-2.5 py-1 text-xs text-graphite"
                  >
                    {option}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Параметры проекта"
        description={title}
      >
        <div className="pb-5">
          <dl className="space-y-3">
            {selection.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-[0.875rem] text-muted">{row.label}</dt>
                <dd className="truncate text-right text-[0.875rem] font-medium text-ink">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          {activeOptions.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="eyebrow mb-2.5">Дополнительно</p>
              <div className="flex flex-wrap gap-2">
                {activeOptions.map((option) => (
                  <span
                    key={option}
                    className="rounded-md bg-surface-3 px-2.5 py-1 text-xs text-graphite"
                  >
                    {option}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {viewerResult && (
        <ImageViewer
          key={viewerResult.id}
          src={viewerResult.imageUrl}
          caption={`Вариант ${viewerResult.index} · ${title}`}
          isDemo={viewerResult.isDemo}
          downloading={downloadingId === viewerResult.id}
          onClose={() => setViewerIndex(null)}
          onDownload={() => void handleDownload(viewerResult)}
          onShare={() => void handleShare(viewerResult)}
          onPrev={
            viewerIndex !== null && viewerIndex > 0
              ? () => setViewerIndex((index) => (index ?? 0) - 1)
              : undefined
          }
          onNext={
            viewerIndex !== null && viewerIndex < results.length - 1
              ? () => setViewerIndex((index) => (index ?? 0) + 1)
              : undefined
          }
        />
      )}
    </>
  )
}
