import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ruler, Sparkles } from 'lucide-react'
import type { MeasurementItem, MeasurementSummary } from '@shared/index'
import {
  applyMeasurements,
  fetchMeasurements,
  parseMeasurementText,
  type Suggestion,
} from '@/api/server/measurements'
import { PageHeader } from '@/components/layout/AppShell'
import { ChecklistRow } from '@/components/measurements/ChecklistRow'
import { SuggestionList } from '@/components/measurements/SuggestionList'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useBilling } from '@/hooks/useBilling'
import { useProject } from '@/hooks/useProject'
import { useSession } from '@/hooks/useSession'
import { useToast } from '@/hooks/useToast'

/**
 * Экран замеров.
 *
 * Здесь одно правило, из которого следует всё остальное: размеры нельзя
 * определять по фотографии. Поэтому у каждого значения виден статус, разбор
 * текста только предлагает, а в производство уходит лишь подтверждённое.
 */

const GROUP_TITLES: Record<MeasurementItem['group'], string> = {
  room: 'Помещение',
  appliance: 'Техника',
  utility: 'Вода и канализация',
}

const PLACEHOLDER =
  'Задняя стена 3200, левая стена 1900. Высота потолка 2,65 м. Глубина столешницы 600, высота 900. Холодильник 600, варочная панель 600, мойка 800. Вода 1200 от угла, канализация 1250.'

export function MeasurementsPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { serverProject } = useProject()
  const { capabilities, refresh: refreshWallet } = useBilling()
  const { show, showError } = useToast()

  const [checklist, setChecklist] = useState<MeasurementItem[]>([])
  const [summary, setSummary] = useState<MeasurementSummary | null>(null)
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  const projectId = serverProject?.id ?? null

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const state = await fetchMeasurements(projectId)
      setChecklist(state.checklist)
      setSummary(state.summary)
    } catch (error) {
      showError(error)
    } finally {
      setLoading(false)
    }
  }, [projectId, showError])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const groups: [MeasurementItem['group'], MeasurementItem[]][] = [
      ['room', []],
      ['appliance', []],
      ['utility', []],
    ]
    const index = new Map(groups)
    for (const item of checklist) index.get(item.group)?.push(item)
    return groups.filter(([, items]) => items.length > 0)
  }, [checklist])

  const handleParse = async (useAi: boolean) => {
    if (!projectId || text.trim().length < 2) return
    setParsing(true)
    try {
      const result = await parseMeasurementText(projectId, text, useAi)
      setSuggestions(result.suggestions)
      // Конфликты по умолчанию не отмечены: перезапись замера — решение человека.
      setSelected(new Set(result.suggestions.filter((item) => !item.conflict).map((item) => item.id)))
      if (result.suggestions.length === 0) {
        show({
          title: 'Не удалось найти числа',
          description: 'Напишите проще: «задняя стена 3200, холодильник 600».',
          variant: 'info',
        })
      }
      if (useAi) void refreshWallet()
    } catch (error) {
      showError(error)
    } finally {
      setParsing(false)
    }
  }

  const applySelected = async (accepted: { id: string; value: number }[]) => {
    if (!projectId || accepted.length === 0) return
    setSaving(true)
    try {
      const result = await applyMeasurements(projectId, accepted)
      setChecklist(result.checklist)
      setSummary(result.summary)
      setSuggestions([])
      setSelected(new Set())
      setText('')
      show({
        title: result.createdNewRevision
          ? `Создана ревизия ${result.revision.revisionNumber}`
          : 'Замеры записаны',
        description: result.createdNewRevision
          ? 'Согласованный вариант остался без изменений.'
          : undefined,
        variant: 'success',
      })
    } catch (error) {
      showError(error)
    } finally {
      setSaving(false)
    }
  }

  if (!session || !projectId) {
    return (
      <>
        <PageHeader
          title="Замеры"
          subtitle="Размеры хранятся в проекте на сервере компании."
          showLogo
        />
        <div className="px-5 py-6 lg:px-10">
          <EmptyState
            icon={<Ruler />}
            title={session ? 'Откройте проект' : 'Войдите в компанию'}
            description={
              session
                ? 'Замеры принадлежат проекту: откройте или создайте его, чтобы вести лист замеров.'
                : 'Лист замеров, статусы значений и история изменений живут на сервере компании.'
            }
            action={
              session ? (
                <Button variant="primary" size="md" onClick={() => navigate('/projects')}>
                  К проектам
                </Button>
              ) : (
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button variant="primary" size="md" onClick={() => navigate('/register')}>
                    Зарегистрировать компанию
                  </Button>
                  <Button variant="secondary" size="md" onClick={() => navigate('/login')}>
                    Войти
                  </Button>
                </div>
              )
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Замеры"
        subtitle="По этим числам режут материал. Предположения в производство не уходят."
        showLogo
      />

      <div className="space-y-5 px-5 py-6 lg:px-10">
        {summary && (
          <section
            className={summaryCardClass(summary)}
            aria-live="polite"
          >
            <p className="text-[0.9375rem] font-medium text-ink">
              Подтверждено {summary.confirmed} из {summary.required} обязательных
            </p>
            {summary.missing.length > 0 && (
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">
                Не хватает: {summary.missing.join(', ')}.
              </p>
            )}
            {summary.unconfirmed.length > 0 && (
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-clay">
                Взято из предположения, нужен замер: {summary.unconfirmed.join(', ')}.
              </p>
            )}
            {summary.readyForProduction && (
              <p className="mt-1.5 text-[0.875rem] text-success">
                Замеров достаточно для техпакета.
              </p>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[1.0625rem] font-semibold text-ink">Впишите замеры как есть</h2>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
            Своими словами, в любом порядке. Разбор найдёт числа и покажет, что понял.
          </p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder={PLACEHOLDER}
            aria-label="Текст замера"
            className="mt-3 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-[0.9375rem] leading-relaxed outline-none transition-colors duration-200 placeholder:text-faint focus:border-ink/60 focus:ring-2 focus:ring-ink/8"
          />
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <Button
              variant="primary"
              size="md"
              disabled={text.trim().length < 2 || parsing}
              loading={parsing}
              onClick={() => void handleParse(false)}
            >
              Разобрать
            </Button>
            {capabilities?.analysisEnabled && (
              <Button
                variant="secondary"
                size="md"
                icon={<Sparkles />}
                disabled={text.trim().length < 2 || parsing}
                onClick={() => void handleParse(true)}
              >
                Разобрать моделью · 1 кредит
              </Button>
            )}
          </div>
        </section>

        {suggestions.length > 0 && (
          <SuggestionList
            suggestions={suggestions}
            selected={selected}
            saving={saving}
            onToggle={(id) =>
              setSelected((current) => {
                const next = new Set(current)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onApply={() =>
              void applySelected(
                suggestions
                  .filter((item) => selected.has(item.id))
                  .map((item) => ({ id: item.id, value: item.value })),
              )
            }
            onDismiss={() => {
              setSuggestions([])
              setSelected(new Set())
            }}
          />
        )}

        {grouped.map(([group, items]) => (
          <section key={group} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[1.0625rem] font-semibold text-ink">{GROUP_TITLES[group]}</h2>
            <div className="mt-2">
              {items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  saving={saving}
                  onSave={(value) => void applySelected([{ id: item.id, value }])}
                />
              ))}
            </div>
          </section>
        ))}

        {loading && checklist.length === 0 && (
          <p className="text-[0.875rem] text-faint">Загружаем лист замеров…</p>
        )}
      </div>
    </>
  )
}

/** Сводка зеленеет только когда всё подтверждено: иначе она успокаивает зря. */
function summaryCardClass(summary: MeasurementSummary): string {
  return summary.readyForProduction
    ? 'rounded-2xl border border-success/30 bg-success/8 p-5'
    : 'rounded-2xl border border-line bg-surface-2 p-5'
}
