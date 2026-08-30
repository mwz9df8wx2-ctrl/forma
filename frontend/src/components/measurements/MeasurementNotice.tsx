import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import type { MeasurementSummary } from '@shared/index'
import { fetchMeasurements } from '@/api/server/measurements'
import { Button } from '@/components/ui/Button'
import { useProject } from '@/hooks/useProject'
import { useSession } from '@/hooks/useSession'

/**
 * Предупреждение над чертежами.
 *
 * Чертёж по неподтверждённым размерам выглядит так же убедительно, как по
 * замеренным, — и именно поэтому по нему режут материал. Разницу должно быть
 * видно до того, как лист уйдёт в цех.
 */
export function MeasurementNotice({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { session } = useSession()
  const { serverProject } = useProject()
  const [summary, setSummary] = useState<MeasurementSummary | null>(null)

  useEffect(() => {
    if (!session || !serverProject) return
    let cancelled = false
    fetchMeasurements(serverProject.id)
      .then((state) => {
        if (!cancelled) setSummary(state.summary)
      })
      .catch(() => {
        /* без сервера предупреждать не о чем: замеры живут там */
      })
    return () => {
      cancelled = true
    }
  }, [session, serverProject])

  if (!summary || summary.readyForProduction) return null

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 rounded-xl border border-clay/30 bg-clay-soft p-4 sm:flex-row sm:items-start">
        <TriangleAlert aria-hidden className="size-5 shrink-0 text-clay" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-clay">
            Чертежи построены не по полному замеру
          </p>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-graphite">
            {summary.missing.length > 0
              ? `Не хватает: ${summary.missing.join(', ')}.`
              : `Взято из предположения: ${summary.unconfirmed.join(', ')}.`}{' '}
            Ошибка в 30–50 мм делает столешницу непригодной — уточните размеры до раскроя.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/measurements')}>
          К замерам
        </Button>
      </div>
    </div>
  )
}
