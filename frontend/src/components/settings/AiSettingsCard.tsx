import { useState } from 'react'
import { Check, Sparkles, TriangleAlert } from 'lucide-react'
import { getProvider, saveAiSettings, type AiProviderId, type AiSettings } from '@/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { useToast } from '@/hooks/useToast'

interface ModeOption {
  id: AiProviderId
  title: string
  description: string
}

const MODES: ModeOption[] = [
  {
    id: 'none',
    title: 'Офлайн-рендер',
    description: 'Визуализация считается на устройстве. Работает без интернета и без ключей.',
  },
  {
    id: 'openai',
    title: 'OpenAI',
    description: 'Фотореалистичная генерация по вашей фотографии. Нужен ключ доступа.',
  },
  {
    id: 'custom',
    title: 'Свой сервис',
    description: 'Любой адрес, принимающий фотографию и параметры и возвращающий изображения.',
  },
]

const SIZE_OPTIONS = [
  { value: '1536x1024', label: 'Горизонтальный — 1536×1024' },
  { value: '1024x1024', label: 'Квадрат — 1024×1024' },
  { value: '1024x1536', label: 'Вертикальный — 1024×1536' },
]

export function AiSettingsCard({
  settings,
  onChange,
}: {
  settings: AiSettings
  onChange: (settings: AiSettings) => void
}) {
  const { show, showError } = useToast()
  const [draft, setDraft] = useState<AiSettings>(settings)
  const [testing, setTesting] = useState(false)

  const update = (patch: Partial<AiSettings>) => setDraft((current) => ({ ...current, ...patch }))

  const handleSave = () => {
    saveAiSettings(draft)
    onChange(draft)
    show({ title: 'Настройки сохранены', variant: 'success' })
  }

  const handleTest = async () => {
    const provider = getProvider(draft)
    if (!provider) return
    setTesting(true)
    try {
      await provider.test(draft)
      show({ title: 'Подключение работает', variant: 'success' })
    } catch (error) {
      showError(toAppError(error, 'unavailable'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
          <Sparkles aria-hidden className="size-4 text-muted" />
          Как создаются визуализации
        </h2>
        <Badge tone={draft.provider === 'none' ? 'neutral' : 'accent'}>
          {draft.provider === 'none' ? 'Офлайн' : 'ИИ'}
        </Badge>
      </div>
      <p className="mb-4 text-[0.875rem] leading-relaxed text-muted">
        Офлайн-режим работает всегда. Подключение сервиса генерации со своим ключом — это
        режим разработчика: в рабочей версии ключ хранится на сервере компании, а приложение
        обращается к нему.
      </p>

      <fieldset className="grid gap-2.5 sm:grid-cols-3">
        <legend className="sr-only">Источник визуализаций</legend>
        {MODES.map((mode) => {
          const checked = draft.provider === mode.id
          return (
            <label
              key={mode.id}
              className={cn(
                'flex cursor-pointer flex-col rounded-xl border p-3.5 transition-[border-color,box-shadow] duration-200',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface',
                checked
                  ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]'
                  : 'border-line hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name="ai-provider"
                value={mode.id}
                checked={checked}
                onChange={() => update({ provider: mode.id })}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-2">
                <span className="text-[0.875rem] font-medium text-ink">{mode.title}</span>
                <span
                  aria-hidden
                  className={cn(
                    'mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                    checked
                      ? 'border-ink bg-ink text-white opacity-100'
                      : 'border-line-strong text-transparent opacity-0',
                  )}
                >
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              </span>
              <span className="mt-1.5 text-xs leading-snug text-muted">{mode.description}</span>
            </label>
          )
        })}
      </fieldset>

      {draft.provider !== 'none' && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {draft.provider === 'custom' && (
            <Input
              label="Адрес сервиса"
              value={draft.endpoint}
              onChange={(event) => update({ endpoint: event.target.value })}
              placeholder="https://api.example.com/kitchen"
              inputMode="url"
              autoComplete="off"
              className="sm:col-span-2"
            />
          )}

          <Input
            label={draft.provider === 'openai' ? 'Ключ доступа' : 'Ключ доступа (если нужен)'}
            type="password"
            value={draft.apiKey}
            onChange={(event) => update({ apiKey: event.target.value })}
            placeholder="sk-…"
            autoComplete="off"
            spellCheck={false}
          />

          {draft.provider === 'openai' && (
            <Input
              label="Модель"
              value={draft.model}
              onChange={(event) => update({ model: event.target.value })}
              placeholder="gpt-image-1"
              autoComplete="off"
              spellCheck={false}
            />
          )}

          {draft.provider === 'openai' && (
            <Select
              label="Формат изображения"
              value={draft.size}
              onChange={(event) => update({ size: event.target.value as AiSettings['size'] })}
              options={SIZE_OPTIONS}
            />
          )}

          <Select
            label="Сколько вариантов создавать"
            value={String(draft.variants)}
            onChange={(event) => update({ variants: Number(event.target.value) })}
            options={[
              { value: '1', label: '1 вариант' },
              { value: '2', label: '2 варианта' },
              { value: '3', label: '3 варианта' },
            ]}
          />
        </div>
      )}

      {draft.provider !== 'none' && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-clay/20 bg-clay-soft p-3.5">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
          <p className="text-xs leading-relaxed text-graphite">
            Режим разработчика. Ключ сохраняется только в этом браузере, но запрос из браузера
            виден в инструментах разработчика. Рабочий путь — войти в компанию: тогда ключ
            остаётся на сервере и в браузер не попадает.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="primary" size="md" onClick={handleSave}>
          Сохранить
        </Button>
        {draft.provider !== 'none' && (
          <Button variant="secondary" size="md" loading={testing} onClick={() => void handleTest()}>
            Проверить подключение
          </Button>
        )}
      </div>
    </section>
  )
}
