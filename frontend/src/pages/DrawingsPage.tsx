import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Ruler } from 'lucide-react'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { buildSchedule, summarize } from '@/drawings/schedule'
import { hardwareTotals, moduleHardware } from '@/drawings/hardware'
import { buildWorktopPlan, renderWorktopSheet } from '@/drawings/worktop'
import { renderElevation } from '@/drawings/elevation'
import { renderPlan } from '@/drawings/plan'
import { svgToDataUrl } from '@/drawings/svg'
import { buildSceneFromParams } from '@/render'
import { cn } from '@/lib/cn'
import { useCatalog } from '@/hooks/useCatalog'
import { useProject } from '@/hooks/useProject'

type Sheet = 'elevation' | 'plan' | 'worktop' | 'schedule' | 'hardware'

const TABS: Array<{ id: Sheet; label: string }> = [
  { id: 'elevation', label: 'Развёртка' },
  { id: 'plan', label: 'План' },
  { id: 'worktop', label: 'Столешница' },
  { id: 'schedule', label: 'Модули' },
  { id: 'hardware', label: 'Крепёж' },
]

/**
 * Рабочие чертежи для производства.
 * Геометрия берётся из той же сцены, что и визуализация, поэтому размеры
 * на чертеже и на картинке всегда совпадают.
 */
export function DrawingsPage() {
  const navigate = useNavigate()
  const { catalog } = useCatalog()
  const { params, title, photo } = useProject()
  const [sheet, setSheet] = useState<Sheet>('elevation')

  const layout = useMemo(() => {
    if (!catalog || !params.materialId || !params.colorId) return null
    return buildSceneFromParams(catalog, params, 0).layout ?? null
  }, [catalog, params])

  const drawings = useMemo(() => {
    if (!layout || !catalog) return null
    const style = catalog.styles.find((item) => item.id === params.styleId)
    const handles = style ? style.traits.handles !== 'hidden' : true
    const worktop = buildWorktopPlan(layout)
    return {
      elevation: renderElevation(layout, title),
      plan: renderPlan(layout, title),
      worktop: renderWorktopSheet(worktop, layout, title),
      worktopPlan: worktop,
      schedule: buildSchedule(layout).map((row) => {
        const module = layout.modules.find((item) => item.id === row.id)
        const hardware = module ? moduleHardware(module, { handles }) : null
        return { ...row, hardware }
      }),
      hardware: hardwareTotals(layout, { handles, worktopJoints: worktop.joints }),
      stats: summarize(layout),
    }
  }, [layout, title, catalog, params.styleId])

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
                  {TABS.map((tab) => (
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

                {(sheet === 'plan' || sheet === 'elevation' || sheet === 'worktop') && (
                  <Button
                    variant="secondary"
                    size="md"
                    icon={<Download />}
                    onClick={() => {
                      const map = {
                        plan: ['plan', drawings.plan],
                        elevation: ['razvertka', drawings.elevation],
                        worktop: ['stoleshnica', drawings.worktop],
                      } as const
                      const [name, svg] = map[sheet]
                      download(name, svg)
                    }}
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

              {(sheet === 'plan' || sheet === 'elevation' || sheet === 'worktop') && (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface p-3">
                  <img
                    src={svgToDataUrl(
                      sheet === 'plan'
                        ? drawings.plan
                        : sheet === 'worktop'
                          ? drawings.worktop
                          : drawings.elevation,
                    )}
                    alt={
                      sheet === 'plan'
                        ? 'План кухни'
                        : sheet === 'worktop'
                          ? 'Схема столешниц'
                          : 'Развёртка по стене'
                    }
                    className="h-auto max-w-none"
                    style={{ width: sheet === 'plan' ? 992 : 1020 }}
                  />
                </div>
              )}

              {sheet === 'worktop' && (
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
                        {['ID', 'Модуль', 'Корпус Ш × В', 'Глуб.', 'Фасады', 'Фурнитура'].map(
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
