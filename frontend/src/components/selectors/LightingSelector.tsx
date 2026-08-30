import { SelectCard } from '@/components/ui/SelectCard'
import { mix } from '@/lib/color'
import type { Lighting } from '@/types'

/** Кружок передаёт характер света: от холодного белого до тёплого золотистого. */
function LightOrb({ lighting }: { lighting: Lighting }) {
  const warm = '#FFB35C'
  const cool = '#DCE9FF'
  const tone = mix(cool, warm, lighting.warmth)
  const edge = mix(tone, '#2A2723', 0.18 + lighting.contrast * 0.35)

  return (
    <div
      aria-hidden
      className="size-14 rounded-full border border-black/5"
      style={{
        background: `radial-gradient(circle at 34% 28%, #FFFFFF 0%, ${tone} 46%, ${edge} 100%)`,
      }}
    />
  )
}

export function LightingSelector({
  lighting,
  value,
  onChange,
}: {
  lighting: Lighting[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
        {lighting.map((item) => (
          <SelectCard
            key={item.id}
            name="lighting"
            value={item.id}
            checked={item.id === value}
            onSelect={onChange}
            layout="row"
            title={item.name}
            caption={`${item.kelvin} K`}
            description={item.description}
            preview={<LightOrb lighting={item} />}
          />
      ))}
    </div>
  )
}
