import { SelectCard } from '@/components/ui/SelectCard'
import { previewFromHex, surfaceStyle } from '@/components/surfaces/surfaceStyle'
import type { ColorOption, Texture } from '@/types'
import { Field } from './ParameterSection'

/** Превью фактуры строится на выбранном цвете фасада — так нагляднее. */
function texturePreview(texture: Texture, color: ColorOption | undefined) {
  const base = color?.hex ?? '#D8D3CB'
  return (
    <div
      aria-hidden
      style={surfaceStyle(previewFromHex(base, texture.grain))}
      className="h-14 w-full border-b border-black/5"
    />
  )
}

export function TextureSelector({
  textures,
  color,
  value,
  onChange,
}: {
  textures: Texture[]
  color: ColorOption | undefined
  value: string | null
  onChange: (value: string) => void
}) {
  const selected = textures.find((texture) => texture.id === value)

  return (
    <Field label="Фактура" value={selected?.name} hint={selected?.description}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {textures.map((texture) => (
          <SelectCard
            key={texture.id}
            name="texture"
            value={texture.id}
            checked={texture.id === value}
            onSelect={onChange}
            title={texture.name}
            preview={texturePreview(texture, color)}
          />
        ))}
      </div>
    </Field>
  )
}
