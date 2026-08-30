import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Wand } from 'lucide-react'
import { isClaudeReady, loadAiSettings, loadClaude, type InteriorAnalysis } from '@/api'
import { AnalysisSheet } from '@/components/analysis/AnalysisSheet'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { ColorSelector } from '@/components/selectors/ColorSelector'
import { CountertopSelector } from '@/components/selectors/CountertopSelector'
import { DimensionsForm } from '@/components/selectors/DimensionsForm'
import { LightingSelector } from '@/components/selectors/LightingSelector'
import { MaterialSelector } from '@/components/selectors/MaterialSelector'
import { OptionsSelector } from '@/components/selectors/OptionsSelector'
import { PaletteSelector } from '@/components/selectors/PaletteSelector'
import { CategorySelector } from '@/components/selectors/CategorySelector'
import { ParameterSection } from '@/components/selectors/ParameterSection'
import { StyleSelector } from '@/components/selectors/StyleSelector'
import { TextureSelector } from '@/components/selectors/TextureSelector'
import { GenerationButton, StickyActionBar } from '@/components/generation/GenerationButton'
import { useCatalog } from '@/hooks/useCatalog'
import { useProject } from '@/hooks/useProject'
import { useToast } from '@/hooks/useToast'
import { describeSelection } from '@/lib/summary'
import { formatBytes } from '@/lib/format'

function CatalogSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((row) => (
        <div key={row}>
          <Skeleton className="h-3 w-24 rounded-full" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <Skeleton key={cell} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProjectPage() {
  const navigate = useNavigate()
  const { catalog, loading, error, reload } = useCatalog()
  const { show, showError } = useToast()
  const {
    photo,
    params,
    title,
    setTitle,
    updateParams,
    setDimension,
    toggleOption,
    selectPalette,
    startGeneration,
    missing,
    canGenerate,
  } = useProject()

  const [starting, setStarting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<InteriorAnalysis | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const claudeReady = isClaudeReady()

  const handleAnalyze = async () => {
    if (!photo || !catalog) return
    setAnalyzing(true)
    try {
      const { analyzeInterior } = await loadClaude()
      const result = await analyzeInterior(loadAiSettings(), photo, catalog)
      setAnalysis(result)
      setAnalysisOpen(true)
    } catch (error) {
      showError(error)
    } finally {
      setAnalyzing(false)
    }
  }

  const applySuggestion = () => {
    if (!analysis) return
    const suggestion = analysis.suggestion
    updateParams({
      materialId: suggestion.materialId,
      colorId: suggestion.colorId,
      textureId: suggestion.textureId,
      paletteId: suggestion.paletteId,
      styleId: suggestion.styleId,
      countertopMaterialId: suggestion.countertopMaterialId,
      countertopColorId: suggestion.countertopColorId,
      lightingId: suggestion.lightingId,
    })
    setAnalysisOpen(false)
    show({ title: 'Параметры подобраны по фотографии', variant: 'success' })
  }


  const handleGenerate = async () => {
    setStarting(true)
    const started = await startGeneration()
    setStarting(false)
    if (started) navigate('/generation')
  }

  const selection = catalog ? describeSelection(catalog, params) : []

  // Фотография необязательна: без неё визуализация строится по размерам,
  // а вписывание в снимок просто недоступно.
  const photoPreview = photo ? (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <img
        src={photo.dataUrl}
        alt="Исходная фотография кухни"
        className="size-16 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] leading-snug font-medium text-ink">Фотография кухни</p>
        <p className="mt-0.5 text-xs text-faint">
          {photo.width}×{photo.height} · {formatBytes(photo.sizeBytes)}
        </p>
      </div>
      <Button variant="quiet" size="sm" className="shrink-0" onClick={() => navigate('/')}>
        Заменить
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] leading-snug font-medium text-ink">Фотографии нет</p>
        <p className="mt-0.5 text-xs leading-snug text-faint">
          Визуализация построится по размерам. Со снимком кухню можно вписать в помещение.
        </p>
      </div>
      <Button variant="quiet" size="sm" className="shrink-0" onClick={() => navigate('/')}>
        Добавить
      </Button>
    </div>
  )

  return (
    <>
      <FlowHeader
        title={title}
        subtitle="Настройка проекта"
        onBack={() => navigate('/')}
        backLabel="Вернуться на главную"
        action={
          <IconButton label="Переименовать проект" onClick={() => {
            setDraftTitle(title)
            setRenaming(true)
          }}>
            <Pencil className="size-[18px]" />
          </IconButton>
        }
      />

      <div className="lg:flex lg:items-start">
        <div className="min-w-0 flex-1 px-5 pt-6 pb-10 lg:px-10 lg:pt-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink lg:text-[1.75rem]">
              Настройте будущую кухню
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
              Выберите материалы и характер интерьера. Изменить параметры можно в любой момент.
            </p>

            <div className="mt-5 lg:hidden">{photoPreview}</div>

            {claudeReady && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                className="mt-3"
                icon={<Wand />}
                loading={analyzing}
                onClick={() => (analysis ? setAnalysisOpen(true) : void handleAnalyze())}
              >
                {analysis ? 'Показать разбор фотографии' : 'Подобрать параметры по фотографии'}
              </Button>
            )}

            <div className="mt-8 space-y-8">
              {loading && <CatalogSkeleton />}

              {error && !loading && (
                <div className="rounded-xl border border-line bg-surface p-5 text-center">
                  <p className="text-[0.9375rem] font-medium text-ink">{error}</p>
                  <p className="mt-1.5 text-[0.8125rem] text-muted">
                    Проверьте соединение и попробуйте ещё раз.
                  </p>
                  <Button variant="secondary" size="md" className="mt-4" onClick={reload}>
                    Повторить
                  </Button>
                </div>
              )}

              {catalog && (
                <>
                  <ParameterSection id="category" eyebrow="Что проектируем">
                    <CategorySelector
                      value={params.category}
                      onChange={(category) => updateParams({ category })}
                    />
                  </ParameterSection>

                  <ParameterSection id="dimensions" eyebrow="Размеры">
                    <DimensionsForm dimensions={params.dimensions} onChange={setDimension} />
                  </ParameterSection>

                  <ParameterSection id="facades" eyebrow="Фасады">
                    <MaterialSelector
                      materials={catalog.materials}
                      value={params.materialId}
                      onChange={(materialId) => updateParams({ materialId })}
                    />
                    <ColorSelector
                      colors={catalog.colors}
                      value={params.colorId}
                      onChange={(colorId) => updateParams({ colorId })}
                    />
                    <TextureSelector
                      textures={catalog.textures}
                      color={catalog.colors.find((color) => color.id === params.colorId)}
                      value={params.textureId}
                      onChange={(textureId) => updateParams({ textureId })}
                    />
                  </ParameterSection>

                  <ParameterSection id="countertop" eyebrow="Столешница">
                    <CountertopSelector
                      countertops={catalog.countertops}
                      materialId={params.countertopMaterialId}
                      colorId={params.countertopColorId}
                      onMaterialChange={(countertopMaterialId) =>
                        updateParams({ countertopMaterialId })
                      }
                      onColorChange={(countertopColorId) => updateParams({ countertopColorId })}
                    />
                  </ParameterSection>

                  <ParameterSection id="palette" eyebrow="Палитра">
                    <PaletteSelector
                      palettes={catalog.palettes}
                      value={params.paletteId}
                      onChange={selectPalette}
                    />
                  </ParameterSection>

                  <ParameterSection id="style" eyebrow="Стиль">
                    <StyleSelector
                      styles={catalog.styles}
                      value={params.styleId}
                      onChange={(styleId) => updateParams({ styleId })}
                    />
                  </ParameterSection>

                  <ParameterSection id="lighting" eyebrow="Освещение">
                    <LightingSelector
                      lighting={catalog.lighting}
                      value={params.lightingId}
                      onChange={(lightingId) => updateParams({ lightingId })}
                    />
                  </ParameterSection>

                  <ParameterSection id="options" eyebrow="Дополнительно">
                    <OptionsSelector
                      options={catalog.options}
                      values={params.options}
                      onChange={toggleOption}
                    />
                  </ParameterSection>
                </>
              )}
            </div>

            <StickyActionBar>
              <GenerationButton
                onClick={() => void handleGenerate()}
                disabled={!canGenerate || loading}
                loading={starting}
                missing={missing}
                category={params.category}
              />
            </StickyActionBar>
          </div>
        </div>

        <aside className="sticky top-0 hidden h-dvh w-[380px] shrink-0 flex-col border-l border-line bg-surface px-6 py-7 lg:flex xl:w-[420px]">
          {photo ? (
            <>
              <img
                src={photo.dataUrl}
                alt="Исходная фотография кухни"
                className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
              />
              <p className="mt-2.5 text-xs text-faint">
                Исходная фотография · {photo.width}×{photo.height} · {formatBytes(photo.sizeBytes)}
              </p>
            </>
          ) : (
            <div className="paper flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-line-strong px-6 text-center">
              <p className="text-[0.8125rem] leading-relaxed text-muted">
                Фотографии нет — визуализация построится по размерам
              </p>
            </div>
          )}

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <h2 className="eyebrow mb-3">Выбранные параметры</h2>
            <dl className="space-y-2.5">
              {selection.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-[0.8125rem] text-muted">{row.label}</dt>
                  <dd className="truncate text-right text-[0.8125rem] font-medium text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <GenerationButton
              onClick={() => void handleGenerate()}
              disabled={!canGenerate || loading}
              loading={starting}
              missing={missing}
              category={params.category}
            />
          </div>
        </aside>
      </div>

      {catalog && (
        <AnalysisSheet
          open={analysisOpen}
          analysis={analysis}
          catalog={catalog}
          onClose={() => setAnalysisOpen(false)}
          onApply={applySuggestion}
        />
      )}

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Название проекта"
        description="Так проект будет отображаться в списке."
        footer={
          <>
            <Button variant="secondary" size="md" fullWidth onClick={() => setRenaming(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => {
                const next = draftTitle.trim()
                if (next) setTitle(next)
                setRenaming(false)
              }}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <div className="pb-4">
          <Input
            label="Название"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Например: Кухня — Ивановы"
            maxLength={60}
            autoFocus
          />
        </div>
      </Modal>
    </>
  )
}
