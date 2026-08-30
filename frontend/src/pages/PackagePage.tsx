import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Printer } from 'lucide-react'
import type { CatalogItem, Estimate } from '@shared/index'
import {
  ESTIMATE_SECTION_LABELS,
  formatQuantity,
  formatRubles,
  type EstimateSection,
} from '@shared/index'
import { listCatalog } from '@/api/server/catalog'
import { createEstimate } from '@/api/server/estimates'
import { buildBom } from '@/drawings/bom'
import { svgToDataUrl } from '@/drawings/svg'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { MeasurementNotice } from '@/components/measurements/MeasurementNotice'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { useDrawings } from '@/hooks/useDrawings'
import { useProject } from '@/hooks/useProject'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format'

/**
 * Техпакет: то, что уходит в цех.
 *
 * Собирается из ProjectSpec и той же геометрии, что и чертежи. Модель в этом
 * не участвует — она не считает производственные размеры.
 *
 * PDF делает печать браузера: он вкладывает шрифт сам, поэтому кириллица
 * остаётся текстом. Собственный генератор PDF со сборкой подмножества шрифта
 * дал бы то же самое, но с риском получить нечитаемый лист в цеху.
 */

function Sheet({ title, svg }: { title: string; svg: string }) {
  return (
    <section className="print-sheet print-break-before mt-6 rounded-2xl border border-line bg-surface p-5 print-plain">
      <h2 className="text-[1.0625rem] font-semibold text-ink">{title}</h2>
      <img
        src={svgToDataUrl(svg)}
        alt={title}
        className="mt-3 w-full rounded-lg border border-line bg-white print:border-0"
      />
    </section>
  )
}

export function PackagePage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { serverProject, project } = useProject()
  const { drawings, layout, params, title } = useDrawings()
  const { showError, show } = useToast()

  const [items, setItems] = useState<CatalogItem[]>([])
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [markup, setMarkup] = useState('30')
  const [pricing, setPricing] = useState(false)

  useEffect(() => {
    if (!session) return
    listCatalog()
      .then(setItems)
      .catch(() => setItems([]))
  }, [session])

  /** Ведомость материалов: те же количества, что на чертежах. */
  const bom = useMemo(() => {
    if (!layout || !drawings) return null
    const byType = (type: CatalogItem['type']) => items.filter((item) => item.type === type)
    const hardwareItemIds: Record<string, string> = {}
    for (const item of byType('hardware')) {
      const kind = (item.attributes as { kind?: string }).kind
      if (kind && !hardwareItemIds[kind]) hardwareItemIds[kind] = item.id
    }

    // Материалы фасада и столешницы выбраны в проекте; корпусный берём
    // первый активный в каталоге — его назначает цех, а не клиент.
    const carcass = byType('carcass')[0] ?? null

    // Артикул компании лежит в выборе цвета: экран делит фасад на материал,
    // цвет и фактуру, а на складе это одна запись каталога.
    const facadeItem = items.find((item) => item.id === params.colorId) ?? null
    const countertopItem = items.find((item) => item.id === params.countertopColorId) ?? null

    return buildBom({
      layout,
      worktop: drawings.worktopPlan,
      hardware: drawings.hardware,
      facadeItemId: facadeItem?.id ?? null,
      countertopItemId: countertopItem?.id ?? null,
      carcassItemId: carcass?.id ?? null,
      hardwareItemIds,
      facadeName: facadeItem ? `Фасады · ${facadeItem.name}` : 'Фасады',
      countertopName: countertopItem ? `Столешница · ${countertopItem.name}` : 'Столешница',
      carcassName: carcass ? `Корпус · ${carcass.name}` : 'Корпусный материал',
    })
  }, [layout, drawings, items, params])

  /** Смета группируется по разделам: так её читают и в цеху, и у клиента. */
  const grouped = useMemo(() => {
    const map = new Map<EstimateSection, Estimate['lines']>()
    for (const line of estimate?.lines ?? []) {
      const list = map.get(line.section) ?? []
      list.push(line)
      map.set(line.section, list)
    }
    return [...map.entries()]
  }, [estimate])

  const price = useCallback(async () => {
    if (!serverProject || !bom) return
    setPricing(true)
    try {
      const created = await createEstimate(serverProject.id, bom, Number(markup) || 0)
      setEstimate(created)
      if (created.totals.missingPrices > 0) {
        show({
          title: `Без цены: ${created.totals.missingPrices} позиций`,
          description: 'Проставьте цены в каталоге — сумма пока неполная.',
          variant: 'info',
        })
      }
    } catch (error) {
      showError(error)
    } finally {
      setPricing(false)
    }
  }, [serverProject, bom, markup, show, showError])

  if (!drawings || !layout) {
    return (
      <>
        <FlowHeader title="Техпакет" subtitle={title} onBack={() => navigate('/setup')} backLabel="К параметрам" />
        <div className="px-5 py-6 lg:px-10">
          <EmptyState
            icon={<FileText />}
            title="Сначала выберите материал и цвет"
            description="Техпакет строится по параметрам проекта: без материала и цвета фасадов состав модулей неизвестен."
            action={
              <Button variant="primary" size="lg" onClick={() => navigate('/setup')}>
                К параметрам
              </Button>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="print-hide">
        <FlowHeader
          title="Техпакет"
          subtitle={title}
          onBack={() => navigate('/drawings')}
          backLabel="К чертежам"
        />
      </div>

      <div className="px-5 pt-6 pb-12 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <section className="print-sheet rounded-2xl border border-line bg-surface p-5 print-plain">
            <p className="eyebrow">Технический пакет</p>
            <h1 className="mt-2 text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink">
              {title}
            </h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.875rem] sm:grid-cols-3">
              <div>
                <dt className="text-muted">Дата</dt>
                <dd className="font-medium text-ink">{formatDate(new Date().toISOString())}</dd>
              </div>
              <div>
                <dt className="text-muted">Модулей</dt>
                <dd className="font-medium text-ink">{drawings.stats.modules}</dd>
              </div>
              <div>
                <dt className="text-muted">Фронт</dt>
                <dd className="font-medium text-ink">
                  {drawings.stats.frontMetres.toFixed(2)} м
                </dd>
              </div>
              <div>
                <dt className="text-muted">Площадь фасадов</dt>
                <dd className="font-medium text-ink">{drawings.stats.facadeArea} м²</dd>
              </div>
              <div>
                <dt className="text-muted">Высота столешницы</dt>
                <dd className="font-medium text-ink">{layout.counter.height} мм</dd>
              </div>
              <div>
                <dt className="text-muted">Проект</dt>
                <dd className="font-medium text-ink">
                  {(serverProject?.id ?? project?.id)?.slice(-6) ?? '—'}
                </dd>
              </div>
            </dl>

            {/*
              Предупреждение печатается всегда, а не только при неполном замере:
              лист уходит в цех, и контрольный замер по месту обязателен.
            */}
            <p className="mt-4 rounded-lg border border-clay/30 bg-clay-soft px-3.5 py-3 text-[0.875rem] leading-relaxed text-clay">
              Перед раскроем обязателен контрольный замер по месту. Размеры на листах взяты
              из спецификации проекта; стены и полы редко бывают ровными, и расхождение
              в 30–50 мм делает столешницу непригодной.
            </p>
          </section>

          <MeasurementNotice className="mt-5 print-hide" />

          <Sheet title="Развёртка по основной стене" svg={drawings.elevation} />
          {drawings.elevationSide && (
            <Sheet title="Развёртка по боковой стене" svg={drawings.elevationSide} />
          )}
          <Sheet title="План" svg={drawings.plan} />
          {drawings.worktop && <Sheet title="Столешница" svg={drawings.worktop} />}

          <section className="print-sheet print-break-before mt-6 rounded-2xl border border-line bg-surface p-5 print-plain">
            <h2 className="text-[1.0625rem] font-semibold text-ink">Спецификация модулей</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[0.875rem]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2 pr-3 font-medium">Модуль</th>
                    <th className="py-2 pr-3 font-medium">Стена</th>
                    <th className="py-2 pr-3 font-medium">Габарит</th>
                    <th className="py-2 pr-3 font-medium">Глубина</th>
                    <th className="py-2 pr-3 font-medium">Фасады</th>
                    <th className="py-2 font-medium">Крепёж</th>
                  </tr>
                </thead>
                <tbody>
                  {drawings.schedule.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-ink">{row.label}</td>
                      <td className="py-2 pr-3 text-muted">{row.wall}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{row.size}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{row.depth}</td>
                      <td className="py-2 pr-3 text-muted">{row.doors}</td>
                      <td className="py-2 text-muted">
                        {row.hardware
                          ? `конфирматов ${row.hardware.confirmats}, петель ${row.hardware.hinges}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="print-sheet mt-6 rounded-2xl border border-line bg-surface p-5 print-plain">
            <h2 className="text-[1.0625rem] font-semibold text-ink">Крепёж и фурнитура</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[0.875rem]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2 pr-3 font-medium">Наименование</th>
                    <th className="py-2 pr-3 font-medium">Количество</th>
                    <th className="py-2 font-medium">Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {drawings.hardware.map((line) => (
                    <tr key={line.name} className="border-b border-line last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-ink">{line.name}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">
                        {line.count} {line.unit}
                      </td>
                      <td className="py-2 text-muted">{line.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="print-sheet print-break-before mt-6 rounded-2xl border border-line bg-surface p-5 print-plain">
            <h2 className="text-[1.0625rem] font-semibold text-ink">Смета</h2>

            {!session || !serverProject ? (
              <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
                Смета считается по каталогу компании на сервере. Войдите и откройте проект,
                чтобы подставить цены.
              </p>
            ) : (
              <>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
                  Количества — из раскроя выше. Цены сервер берёт из каталога компании и
                  сохраняет снимком: согласованная сумма не изменится, если материал подорожает.
                </p>

                <div className="print-hide mt-4 flex flex-wrap items-end gap-3">
                  <div className="w-40">
                    <Input
                      label="Наценка, %"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={500}
                      value={markup}
                      onChange={(event) => setMarkup(event.target.value)}
                    />
                  </div>
                  <Button variant="primary" size="md" loading={pricing} onClick={() => void price()}>
                    {estimate ? 'Пересчитать' : 'Посчитать смету'}
                  </Button>
                </div>
              </>
            )}

            {estimate && (
              <div className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-[0.875rem]">
                    <thead>
                      <tr className="border-b border-line text-left text-muted">
                        <th className="py-2 pr-3 font-medium">Позиция</th>
                        <th className="py-2 pr-3 font-medium">Количество</th>
                        <th className="py-2 pr-3 font-medium">Цена</th>
                        <th className="py-2 font-medium">Сумма</th>
                      </tr>
                    </thead>
                    {grouped.map(([section, lines]) => (
                      <tbody key={section}>
                        <tr>
                          <th colSpan={4} className="pt-4 pb-1 text-left">
                            <span className="eyebrow">{ESTIMATE_SECTION_LABELS[section]}</span>
                          </th>
                        </tr>
                        {lines.map((line, index) => (
                          <tr key={`${line.name}-${index}`} className="border-b border-line">
                            <td className="w-1/2 py-1.5 pr-3 text-ink">{line.name}</td>
                            <td className="py-1.5 pr-3 tabular-nums text-muted">
                              {formatQuantity(line.quantityMilli, line.unit)}
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums text-muted">
                              {line.priceMissing ? 'нет в каталоге' : formatRubles(line.unitPriceKopecks)}
                            </td>
                            <td className="py-1.5 tabular-nums text-ink">
                              {line.priceMissing ? '—' : formatRubles(line.totalKopecks)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>

                <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[0.9375rem]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Материалы и фурнитура</dt>
                    <dd className="tabular-nums text-ink">
                      {formatRubles(estimate.totals.materialsKopecks)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Наценка {estimate.markupPercent}%</dt>
                    <dd className="tabular-nums text-ink">
                      {formatRubles(estimate.totals.markupKopecks)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-line pt-2">
                    <dt className="font-semibold text-ink">Итого</dt>
                    <dd className="text-[1.0625rem] font-semibold tabular-nums text-ink">
                      {formatRubles(estimate.totals.totalKopecks)}
                    </dd>
                  </div>
                </dl>

                {estimate.totals.missingPrices > 0 && (
                  <p className="mt-3 rounded-lg bg-clay-soft px-3 py-2.5 text-[0.8125rem] leading-snug text-clay">
                    {estimate.totals.missingPrices} позиций без цены в каталоге — сумма неполная.
                    Проставьте цены в разделе «Каталог».
                  </p>
                )}

                <p className="mt-3 text-[0.8125rem] leading-snug text-faint">
                  Цены зафиксированы {formatDate(estimate.createdAt)}.
                </p>
              </div>
            )}
          </section>

          <div className="print-hide mt-8 flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<Printer />}
              onClick={() => window.print()}
            >
              Печать · сохранить PDF
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/drawings')}>
              К чертежам
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
