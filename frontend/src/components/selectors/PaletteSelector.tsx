import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Palette } from '@/types'

export function PaletteSelector({
  palettes,
  value,
  onChange,
}: {
  palettes: Palette[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
        {palettes.map((palette) => {
          const checked = palette.id === value
          return (
            <label
              key={palette.id}
              className={cn(
                'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface',
                'transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas',
                checked
                  ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]'
                  : 'border-line hover:border-line-strong hover:shadow-card md:hover:-translate-y-0.5',
              )}
            >
              <input
                type="radio"
                name="palette"
                value={palette.id}
                checked={checked}
                onChange={() => onChange(palette.id)}
                className="sr-only"
              />

              <span aria-hidden className="flex h-16 w-full">
                {palette.swatches.map((swatch) => (
                  <span
                    key={swatch.hex + swatch.name}
                    className="h-full flex-1"
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </span>

              <span className="flex flex-1 flex-col p-3.5">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[0.9375rem] leading-tight font-medium text-ink">
                    {palette.name}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'mt-px flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                      checked
                        ? 'scale-100 border-ink bg-ink text-white opacity-100'
                        : 'scale-90 border-line-strong text-transparent opacity-0 group-hover:opacity-100',
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                </span>
                <span className="mt-1.5 text-xs leading-relaxed text-muted">
                  {palette.description}
                </span>
                <span className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1">
                  {palette.swatches.map((swatch) => (
                    <span key={swatch.name} className="text-[0.6875rem] text-faint">
                      {swatch.name}
                    </span>
                  ))}
                </span>
              </span>
          </label>
        )
      })}
    </div>
  )
}
