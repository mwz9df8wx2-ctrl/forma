import { useRef, useState } from 'react'
import { Download, Expand, Maximize2, WandSparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { GenerationResult } from '@/types'

function ResultCard({
  result,
  onOpen,
  onDownload,
  onSimilar,
  onHighRes,
  downloading,
  renderingHighRes,
}: {
  result: GenerationResult
  onOpen: () => void
  onDownload: () => void
  onSimilar: () => void
  onHighRes: () => void
  downloading: boolean
  renderingHighRes: boolean
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть вариант ${result.index} на весь экран`}
        className="group relative block aspect-[3/2] w-full overflow-hidden bg-surface-3"
      >
        <img
          src={result.imageUrl}
          alt={`Визуализация кухни, вариант ${result.index}`}
          className="size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02]"
        />
        <span className="absolute top-3 left-3 flex gap-2">
          <Badge tone="inverse">Вариант {result.index}</Badge>
          {result.isDemo && (
            <Badge tone="light">Демо</Badge>
          )}
        </span>
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-lg bg-ink/70 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
        >
          <Maximize2 className="size-4" />
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex gap-2">
          <Button variant="primary" size="md" className="flex-1" onClick={onOpen}>
            Открыть
          </Button>
          <IconButton
            label={`Скачать вариант ${result.index}`}
            variant="secondary"
            onClick={onDownload}
            disabled={downloading}
          >
            <Download className="size-5" />
          </IconButton>
        </div>
        <Button variant="quiet" size="md" fullWidth icon={<WandSparkles />} onClick={onSimilar}>
          Создать похожий
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          icon={<Expand />}
          loading={renderingHighRes}
          onClick={onHighRes}
        >
          Скачать крупно
        </Button>
      </div>
    </article>
  )
}

export function GenerationResults({
  results,
  onOpen,
  onDownload,
  onSimilar,
  onHighRes,
  downloadingId,
  highResId,
}: {
  results: GenerationResult[]
  onOpen: (index: number) => void
  onDownload: (result: GenerationResult) => void
  onSimilar: (result: GenerationResult) => void
  onHighRes: (result: GenerationResult) => void
  downloadingId: string | null
  highResId: string | null
}) {
  const [active, setActive] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    const track = trackRef.current
    if (!track) return
    const child = track.firstElementChild as HTMLElement | null
    if (!child) return
    const width = child.offsetWidth + 12
    setActive(Math.round(track.scrollLeft / width))
  }

  return (
    <div>
      {/* Телефон: карусель с прокруткой по вариантам */}
      <div className="lg:hidden">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
        >
          {results.map((result, index) => (
            <div key={result.id} className="w-[85%] max-w-sm shrink-0 snap-center">
              <ResultCard
                result={result}
                onOpen={() => onOpen(index)}
                onDownload={() => onDownload(result)}
                onSimilar={() => onSimilar(result)}
                onHighRes={() => onHighRes(result)}
                downloading={downloadingId === result.id}
                renderingHighRes={highResId === result.id}
              />
            </div>
          ))}
        </div>

        {results.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
            {results.map((result, index) => (
              <span
                key={result.id}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  index === active ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Десктоп: варианты рядом */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2 2xl:grid-cols-3">
        {results.map((result, index) => (
          <ResultCard
            key={result.id}
            result={result}
            onOpen={() => onOpen(index)}
            onDownload={() => onDownload(result)}
            onSimilar={() => onSimilar(result)}
            onHighRes={() => onHighRes(result)}
            downloading={downloadingId === result.id}
            renderingHighRes={highResId === result.id}
          />
        ))}
      </div>
    </div>
  )
}
