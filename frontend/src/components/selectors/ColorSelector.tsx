import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { readableInk } from '@/lib/color'
import { previewFromHex, surfaceStyle } from '@/components/surfaces/surfaceStyle'
import type { ColorOption } from '@/types'
import { Field } from './ParameterSection'

export function ColorSelector({
  colors,
  value,
  onChange,
  label = 'Цвет',
  name = 'color',
}: {
  colors: ColorOption[]
  value: string | null
  onChange: (value: string) => void
  label?: string
  name?: string
}) {
  const selected = colors.find((color) => color.id === value)

  return (
    <Field label={label} value={selected?.name} hint={selected?.description}>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-6">
        {colors.map((color) => {
          const checked = color.id === value
          return (
            <label
              key={color.id}
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
                name={name}
                value={color.id}
                checked={checked}
                onChange={() => onChange(color.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                style={surfaceStyle(previewFromHex(color.hex, color.grain))}
                className="relative flex aspect-square w-full items-center justify-center border-b border-black/5"
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full transition-all duration-200',
                    checked ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
                  )}
                  style={{
                    backgroundColor: readableInk(color.hex),
                    color: readableInk(color.hex) === '#ffffff' ? '#1a1917' : '#ffffff',
                  }}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              </span>
              <span className="block px-2.5 py-2 text-[0.8125rem] leading-tight font-medium text-ink">
                {color.name}
              </span>
            </label>
          )
        })}
      </div>
    </Field>
  )
}
