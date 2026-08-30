import { useState } from 'react'
import { Brain, TriangleAlert } from 'lucide-react'
import { loadClaude, saveAiSettings, type AiSettings } from '@/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toAppError } from '@/lib/errors'
import { useToast } from '@/hooks/useToast'

/**
 * Claude разбирает фотографию и подбирает параметры кухни.
 * Изображения он не рисует — это отдельная возможность и отдельный ключ.
 */
export function ClaudeCard({
  settings,
  onChange,
}: {
  settings: AiSettings
  onChange: (settings: AiSettings) => void
}) {
  const { show, showError } = useToast()
  const [draft, setDraft] = useState<AiSettings>(settings)
  const [testing, setTesting] = useState(false)

  const connected = draft.claudeApiKey.trim().length > 20

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
          <Brain aria-hidden className="size-4 text-muted" />
          Разбор фотографии
        </h2>
        <Badge tone={connected ? 'accent' : 'neutral'}>{connected ? 'Claude' : 'Выключено'}</Badge>
      </div>
      <p className="mb-4 text-[0.875rem] leading-relaxed text-muted">
        Claude смотрит на снимок помещения, отмечает, что помешает монтажу, и подбирает набор
        материалов, цвета, стиля и света. Визуализацию он не рисует — это делает движок
        приложения.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Ключ доступа Anthropic"
          type="password"
          value={draft.claudeApiKey}
          onChange={(event) => setDraft({ ...draft, claudeApiKey: event.target.value })}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label="Модель"
          value={draft.claudeModel}
          onChange={(event) => setDraft({ ...draft, claudeModel: event.target.value })}
          placeholder="claude-opus-5"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {connected && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-clay/20 bg-clay-soft p-3.5">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
          <p className="text-xs leading-relaxed text-graphite">
            Ключ хранится только в этом браузере, но запрос уходит с устройства напрямую в
            Anthropic — в инструментах разработчика он виден. Для рабочего продукта запрос должен
            идти через ваш сервер.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            saveAiSettings(draft)
            onChange(draft)
            show({ title: 'Настройки сохранены', variant: 'success' })
          }}
        >
          Сохранить
        </Button>
        {connected && (
          <Button
            variant="secondary"
            size="md"
            loading={testing}
            onClick={async () => {
              setTesting(true)
              try {
                const { testClaude } = await loadClaude()
                await testClaude(draft)
                show({ title: 'Claude отвечает', variant: 'success' })
              } catch (error) {
                showError(toAppError(error, 'unavailable'))
              } finally {
                setTesting(false)
              }
            }}
          >
            Проверить ключ
          </Button>
        )}
      </div>
    </section>
  )
}
