import { Check, Gauge } from 'lucide-react'
import {
  QUALITY_TIERS,
  qualityDescription,
  qualityLabel,
  qualityProfile,
  saveQualityTier,
  type QualityTier,
} from '@/mock/quality'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { useToast } from '@/hooks/useToast'

export function QualityCard({
  tier,
  onChange,
}: {
  tier: QualityTier
  onChange: (tier: QualityTier) => void
}) {
  const { show } = useToast()
  const profile = qualityProfile(tier)

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
          <Gauge aria-hidden className="size-4 text-muted" />
          Качество визуализации
        </h2>
        <Badge tone="neutral">
          {profile.width}×{Math.round(profile.width / 1.5)}
        </Badge>
      </div>
      <p className="mb-4 text-[0.875rem] leading-relaxed text-muted">
        Чем выше качество, тем дольше считается кадр. Разрешение подстраивается под
        возможности устройства.
      </p>

      <fieldset className="grid gap-2.5 sm:grid-cols-3">
        <legend className="sr-only">Уровень качества</legend>
        {QUALITY_TIERS.map((option) => {
          const checked = option === tier
          return (
            <label
              key={option}
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
                name="quality-tier"
                value={option}
                checked={checked}
                onChange={() => {
                  saveQualityTier(option)
                  onChange(option)
                  show({ title: `Качество: ${qualityLabel(option).toLowerCase()}`, variant: 'success' })
                }}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-2">
                <span className="text-[0.875rem] font-medium text-ink">{qualityLabel(option)}</span>
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
              <span className="mt-1.5 text-xs leading-snug text-muted">
                {qualityDescription(option)}
              </span>
            </label>
          )
        })}
      </fieldset>
    </section>
  )
}
