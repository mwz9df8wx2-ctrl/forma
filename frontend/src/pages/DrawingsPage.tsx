import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Ruler } from 'lucide-react'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { MeasurementNotice } from '@/components/measurements/MeasurementNotice'
import { svgToDataUrl } from '@/drawings/svg'
import { cn } from '@/lib/cn'
import { useDrawings } from '@/hooks/useDrawings'
import { useProject } from '@/hooks/useProject'

type Sheet = 'elevation' | 'elevationSide' | 'plan' | 'worktop' | 'schedule' | 'hardware'

const TABS: Array<{ id: Sheet; label: string }> = [
  { id: 'elevation', label: 'Развёртка' },
  { id: 'elevationSide', label: 'Боковая стена' },
  { id: 'plan', label: 'План' },
  { id: 'worktop', label: 'Столешница' },
  { id: 'schedule', label: 'Модули' },
  { id: 'hardware', label: 'Крепёж' },
]

interface SheetImage {
  svg: string
  alt: string
  file: string
  width: number
}

/**
 * Рабочие чертежи для производства.
 * Геометрия берётся из той же сцены, что и визуализация, поэтому размеры
 * на чертеже и на картинке всегда совпадают.
 */
export function DrawingsPage() {
  const navigate = useNavigate()
  const { photo } = useProject()
  const { drawings, title } = useDrawings()
  const [sheet, setSheet] = useState<Sheet>('elevation')

  // Листы-картинки собраны в один справочник: иначе выбор нужного SVG
  // расползается по трём тернарным выражениям и расходится с кнопкой скачивания.
  const imageSheets: Partial<Record<Sheet, SheetImage>> = drawings
    ? {
        elevation: {
          svg: drawings.elevation,
          alt: 'Развёртка по основной стене',
          file: 'razvertka',
          width: 1020,
        },
        ...(drawings.elevationSide
          ? {
              elevationSide: {
                svg: drawings.elevationSide,
                alt: 'Развёртка по боковой стене',
                file: 'razvertka-bokovaya',
                width: 1020,
              },
            }
          : {}),
        plan: { svg: drawings.plan, alt: 'План', file: 'plan', width: 992 },
        // У шкафа столешницы нет — лист не выпускается.
        ...(drawings.worktop
          ? {
              worktop: {
                svg: drawings.worktop,
                alt: 'Схема столешниц',
                file: 'stoleshnica',
                width: 1020,
              },
            }
          : {}),
      }
    : {}
  const currentImage = imageSheets[sheet] ?? null

  const download = (name: string, svg: string) => {
    const link = document.createElement('a')
    link.href = svgToDataUrl(svg)
    link.download = `${name}.svg`
    document.body.append(link)
    link.click()
    link.remove()
  }

  return (
    <>
      <FlowHeader
        title="Чертежи"
        subtitle={title}
        onBack={() => navigate(photo ? '/setup' : '/')}
        backLabel="Вернуться к параметрам"
      />

      <div className="px-5 pt-6 pb-12 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink lg:text-[1.75rem]">
            Рабочие чертежи
          </h1>
          <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-muted">
            Развёртка, план и спецификация модулей строятся из тех же размеров, что и
            визуализация. Все размеры в миллиметрах.
          </p>

          <MeasurementNotice className="mt-5" />

          {!drawings && (
            <EmptyState
              className="mt-8"
              icon={<Ruler />}
              title="Сначала выберите материал и цвет"
              description="Чертежи строятся по параметрам проекта: без материала и цвета фасадов состав модулей неизвестен."
              action={
                <Button variant="primary" size="lg" onClick={() => navigate('/setup')}>
                  К параметрам
                </Button>
              }
            />
          )}

          {drawings && (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Листы чертежей"
                  className="inline-flex gap-1 rounded-lg bg-surface-3 p-1"
                >
                  {TABS.filter((tab) => {
                    // Вкладка боковой стены — только у угловой кухни,
                    // вкладка столешницы — только там, где столешница есть.
                    if (tab.id === 'elevationSide') return Boolean(drawings?.elevationSide)
                    if (tab.id === 'worktop') return Boolean(drawings?.worktop)
                    return true
                  }).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={sheet === tab.id}
                      onClick={() => setSheet(tab.id)}
                      className={cn(
                        'min-h-10 rounded-md px-4 text-[0.875rem] font-medium transition-all duration-200',
                        sheet === tab.id ? 'bg-surface text-ink shadow-hair' : 'text-muted hover:text-ink',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {currentImage && (
                  <Button
                    variant="secondary"
                    size="md"
                    icon={<Download />}
                    onClick={() => download(currentImage.file, currentImage.svg)}
                  >
                    Скачать чертёж
                  </Button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem] text-muted">
                <span>
                  Фронт: <span className="font-medium text-ink">{drawings.stats.frontMetres.toFixed(2)} м</span>
                </span>
                <span>
                  Модулей: <span className="font-medium text-ink">{drawings.stats.modules}</span>
                </span>
                <span>
                  Площадь фасадов:{' '}
                  <span className="font-medium text-ink">{drawings.stats.facadeArea} м²</span>
                </span>
              </div>

              {currentImage && (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface p-3">
                  <img
                    src={svgToDataUrl(currentImage.svg)}
                    alt={currentImage.alt}
                    className="h-auto max-w-none"
                    style={{ width: currentImage.width }}
                  />
                </div>
              )}

              {sheet === 'worktop' && drawings.worktop && (
                <div className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-5">
                  <p className="text-[0.875rem] font-medium text-ink">Примечания к столешнице</p>
                  <ul className="space-y-1.5">
                    {drawings.worktopPlan.notes.map((note) => (
                      <li key={note} className="text-[0.8125rem] leading-snug text-graphite">
                        · {note}
                      </li>
                    ))}
                  </ul>
                  {drawings.worktopPlan.parts.some((part) => part.cutouts.length > 0) && (
                    <div className="rounded-lg border border-clay/20 bg-clay-soft p-3.5">
                      <p className="text-[0.8125rem] leading-relaxed text-graphite">
                        Размеры вырезов предварительные. Точный размер зависит от модели техники —
                        перед раскроем сверьтесь с монтажной картой производителя.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {sheet === 'hardware' && (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
                  <table className="w-full min-w-[520px] border-collapse text-[0.875rem]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        {['Наименование', 'Количество', 'Примечание'].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="px-4 py-3 text-[0.75rem] font-semibold tracking-[0.06em] text-faint uppercase"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drawings.hardware.map((line) => (
                        <tr key={line.name} className="border-b border-line last:border-0">
                          <td className="px-4 py-2.5 text-ink">{line.name}</td>
                          <td className="px-4 py-2.5 font-semibold tabular-nums text-ink">
                            {line.count} {line.unit}
                          </td>
                          <td className="px-4 py-2.5 text-muted">{line.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sheet === 'schedule' && (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
                  <table className="w-full min-w-[640px] border-collapse text-[0.875rem]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        {['ID', 'Модуль', 'Стена', 'Корпус Ш × В', 'Глуб.', 'Фасады', 'Фурнитура'].map(
                          (heading) => (
                            <th
                              key={heading}
                              scope="col"
                              className="px-4 py-3 text-[0.75rem] font-semibold tracking-[0.06em] text-faint uppercase"
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {drawings.schedule.map((row) => (
                        <tr key={row.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-2.5 font-semibold text-ink">{row.id}</td>
                          <td className="px-4 py-2.5 text-graphite">{row.label}</td>
                          <td className="px-4 py-2.5 text-graphite">{row.wall}</td>
                          <td className="px-4 py-2.5 tabular-nums text-graphite">{row.size}</td>
                          <td className="px-4 py-2.5 tabular-nums text-graphite">{row.depth}</td>
                          <td className="px-4 py-2.5 tabular-nums text-graphite">{row.doors}</td>
                          <td className="px-4 py-2.5 text-[0.8125rem] leading-snug text-muted">
                            {row.hardware
                              ? [
                                  row.hardware.confirmats > 0
                                    ? `${row.hardware.confirmats} конфирматов 7×50`
                                    : null,
                                  row.hardware.hinges > 0
                                    ? `${row.hardware.hinges} петли ${row.hardware.hingeAngle}°`
                                    : null,
                                  row.hardware.slides > 0
                                    ? `${row.hardware.slides} пары направляющих ${row.hardware.slideLength} мм`
                                    : null,
                                  row.hardware.handles > 0 ? `${row.hardware.handles} ручка` : null,
                                  row.hardware.bracketSets > 0
                                    ? `${row.hardware.bracketSets} навес`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(', ') || '—'
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
