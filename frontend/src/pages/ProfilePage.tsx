import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Server, Smartphone, Trash2 } from 'lucide-react'
import { API_URL, USE_MOCK_API, getGenerationSource, loadAiSettings, type AiSettings } from '@/api'
import { AiSettingsCard } from '@/components/settings/AiSettingsCard'
import { ClaudeCard } from '@/components/settings/ClaudeCard'
import { QualityCard } from '@/components/settings/QualityCard'
import { loadQualityTier, type QualityTier } from '@/mock/quality'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Dialog'
import { useProject } from '@/hooks/useProject'
import { useProjects } from '@/hooks/useProjects'
import { useToast } from '@/hooks/useToast'
import { plural } from '@/lib/format'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[0.875rem] text-muted">{label}</span>
      <span className="truncate text-right text-[0.875rem] font-medium text-ink">{value}</span>
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { projects, remove, refresh } = useProjects()
  const { resetProject } = useProject()
  const { show } = useToast()
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings())
  const [quality, setQuality] = useState<QualityTier>(() => loadQualityTier())
  const source = getGenerationSource()

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleClear = async () => {
    setConfirmClear(false)
    await Promise.all(projects.map((project) => remove(project.id)))
    resetProject()
    await refresh()
    show({ title: 'Проекты удалены с устройства', variant: 'success' })
  }

  return (
    <>
      <PageHeader showLogo title="Профиль" subtitle="Настройки приложения и данные на устройстве." />

      <div className="px-5 pt-7 pb-10 lg:px-10">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
                <Server aria-hidden className="size-4 text-muted" />
                Режим работы
              </h2>
              <Badge tone={source === 'server' ? 'success' : source === 'ai' ? 'accent' : 'neutral'}>
                {source === 'server' ? 'Сервер' : source === 'ai' ? 'ИИ' : 'Офлайн'}
              </Badge>
            </div>
            <p className="text-[0.875rem] leading-relaxed text-muted">
              {source === 'server'
                ? 'Проекты и визуализации обрабатывает рабочий сервер.'
                : source === 'ai'
                  ? 'Справочники хранятся на устройстве, изображения создаёт подключённый сервис генерации.'
                  : 'Приложение работает автономно: справочники и визуализации формируются прямо на устройстве.'}
            </p>
            {!USE_MOCK_API && (
              <div className="mt-3 divide-y divide-line border-t border-line">
                <Row label="Адрес сервера" value={API_URL} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
              <Smartphone aria-hidden className="size-4 text-muted" />
              На телефоне
            </h2>
            <p className="text-[0.875rem] leading-relaxed text-muted">
              Добавьте приложение на домашний экран — оно откроется во весь экран, как обычное
              приложение.
            </p>
            {installEvent ? (
              <Button
                variant="secondary"
                size="md"
                className="mt-4"
                icon={<Download />}
                onClick={() => {
                  void installEvent.prompt()
                  setInstallEvent(null)
                }}
              >
                Установить приложение
              </Button>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-faint">
                В Safari: «Поделиться» → «На экран «Домой»». В Chrome: меню → «Установить
                приложение».
              </p>
            )}
          </section>

          <AiSettingsCard settings={aiSettings} onChange={setAiSettings} />

          <ClaudeCard settings={aiSettings} onChange={setAiSettings} />

          {source !== 'ai' && <QualityCard tier={quality} onChange={setQuality} />}

          <section className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
            <h2 className="mb-1 text-[0.9375rem] font-semibold text-ink">Данные на устройстве</h2>
            <div className="divide-y divide-line">
              <Row
                label="Проекты"
                value={`${projects.length} ${plural(projects.length, ['проект', 'проекта', 'проектов'])}`}
              />
              <Row label="Версия приложения" value="1.0.0" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  resetProject()
                  navigate('/')
                }}
              >
                Новая визуализация
              </Button>
              <Button
                variant="danger"
                size="md"
                icon={<Trash2 />}
                disabled={projects.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                Очистить проекты
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Очистить проекты?"
        description="Все проекты будут удалены с этого устройства. Действие нельзя отменить."
        footer={
          <>
            <Button variant="secondary" size="md" fullWidth onClick={() => setConfirmClear(false)}>
              Отмена
            </Button>
            <Button variant="danger" size="md" fullWidth onClick={() => void handleClear()}>
              Очистить
            </Button>
          </>
        }
      />
    </>
  )
}
