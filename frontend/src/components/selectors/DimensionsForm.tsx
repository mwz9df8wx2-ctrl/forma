import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { DIMENSION_LIMITS } from '@/mock/catalog'
import type { Dimensions } from '@/types'

const FIELDS = Object.keys(DIMENSION_LIMITS) as Array<keyof Dimensions>

export function DimensionsForm({
  dimensions,
  onChange,
}: {
  dimensions: Dimensions
  onChange: (key: keyof Dimensions, value: number) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field, String(dimensions[field])])),
  )

  // Значения могут прийти извне — например, при открытии сохранённого проекта.
  useEffect(() => {
    setDrafts(Object.fromEntries(FIELDS.map((field) => [field, String(dimensions[field])])))
  }, [dimensions])

  const handleChange = (field: keyof Dimensions, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 5)
    setDrafts((current) => ({ ...current, [field]: digits }))
    const parsed = Number.parseInt(digits, 10)
    if (Number.isFinite(parsed)) onChange(field, parsed)
  }

  const handleBlur = (field: keyof Dimensions) => {
    const limits = DIMENSION_LIMITS[field]
    const parsed = Number.parseInt(drafts[field] ?? '', 10)
    const safe = Number.isFinite(parsed)
      ? Math.min(limits.max, Math.max(limits.min, parsed))
      : limits.min
    setDrafts((current) => ({ ...current, [field]: String(safe) }))
    onChange(field, safe)
  }

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {FIELDS.map((field) => {
        const limits = DIMENSION_LIMITS[field]
        const parsed = Number.parseInt(drafts[field] ?? '', 10)
        const invalid = Number.isFinite(parsed) && (parsed < limits.min || parsed > limits.max)

        return (
          <Input
            key={field}
            label={limits.label}
            value={drafts[field] ?? ''}
            onChange={(event) => handleChange(field, event.target.value)}
            onBlur={() => handleBlur(field)}
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            suffix="мм"
            error={invalid ? limits.hint : undefined}
            hint={invalid ? undefined : limits.hint}
          />
        )
      })}
    </div>
  )
}
