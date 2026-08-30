import { SelectCard } from '@/components/ui/SelectCard'
import { SurfaceTile } from '@/components/surfaces/SurfaceTile'
import type { Material } from '@/types'
import { Field } from './ParameterSection'

export function MaterialSelector({
  materials,
  value,
  onChange,
}: {
  materials: Material[]
  value: string | null
  onChange: (value: string) => void
}) {
  const selected = materials.find((material) => material.id === value)

  return (
    <Field label="Материал" value={selected?.name} hint={selected?.description}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {materials.map((material) => (
          <SelectCard
            key={material.id}
            name="material"
            value={material.id}
            checked={material.id === value}
            onSelect={onChange}
            title={material.name}
            caption={material.caption}
            preview={<SurfaceTile preview={material.preview} />}
          />
        ))}
      </div>
    </Field>
  )
}
