import { CircleAlert, Eye, Lightbulb, Wand } from 'lucide-react'
import type { InteriorAnalysis } from '@/api'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Dialog'
import type { Catalog } from '@/types'

function nameOf(items: Array<{ id: string; name: string }>, id: string): string {
  return items.find((item) => item.id === id)?.name ?? id
}

/** Разбор снимка: что видно, что помешает и какой набор параметров предложен. */
export function AnalysisSheet({
  open,
  analysis,
  catalog,
  onClose,
  onApply,
}: {
  open: boolean
  analysis: InteriorAnalysis | null
  catalog: Catalog
  onClose: () => void
  onApply: () => void
}) {
  if (!analysis) return null
  const suggestion = analysis.suggestion

  const rows = [
    ['Материал', nameOf(catalog.materials, suggestion.materialId)],
    ['Цвет', nameOf(catalog.colors, suggestion.colorId)],
    ['Фактура', nameOf(catalog.textures, suggestion.textureId)],
    ['Столешница', nameOf(catalog.countertops.materials, suggestion.countertopMaterialId)],
    ['Палитра', nameOf(catalog.palettes, suggestion.paletteId)],
    ['Стиль', nameOf(catalog.styles, suggestion.styleId)],
    ['Освещение', nameOf(catalog.lighting, suggestion.lightingId)],
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Разбор фотографии"
      description={analysis.roomSummary}
      footer={
        <>
          <Button variant="secondary" size="md" fullWidth onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="primary" size="md" fullWidth icon={<Wand />} onClick={onApply}>
            Применить подбор
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-4">
        <section>
          <h3 className="eyebrow mb-2.5">Предложенные параметры</h3>
          <dl className="space-y-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-[0.875rem] text-muted">{label}</dt>
                <dd className="truncate text-right text-[0.875rem] font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-[0.8125rem] leading-relaxed text-graphite">
            {suggestion.reason}
          </p>
        </section>

        {analysis.observations.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2.5 flex items-center gap-1.5">
              <Eye aria-hidden className="size-3.5" />
              Что видно на снимке
            </h3>
            <ul className="space-y-1.5">
              {analysis.observations.map((item) => (
                <li key={item} className="text-[0.875rem] leading-snug text-graphite">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {analysis.risks.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2.5 flex items-center gap-1.5 text-clay">
              <CircleAlert aria-hidden className="size-3.5" />
              На что обратить внимание
            </h3>
            <ul className="space-y-1.5">
              {analysis.risks.map((item) => (
                <li key={item} className="text-[0.875rem] leading-snug text-graphite">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {analysis.recommendations.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2.5 flex items-center gap-1.5">
              <Lightbulb aria-hidden className="size-3.5" />
              Рекомендации
            </h3>
            <ul className="space-y-3">
              {analysis.recommendations.map((item) => (
                <li key={item.title}>
                  <p className="text-[0.875rem] font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}
