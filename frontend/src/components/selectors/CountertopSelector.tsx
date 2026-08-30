import { SelectCard } from '@/components/ui/SelectCard'
import { SurfaceTile } from '@/components/surfaces/SurfaceTile'
import type { CountertopCatalog } from '@/types'
import { ColorSelector } from './ColorSelector'
import { Field } from './ParameterSection'

export function CountertopSelector({
  countertops,
  materialId,
  colorId,
  onMaterialChange,
  onColorChange,
}: {
  countertops: CountertopCatalog
  materialId: string | null
  colorId: string | null
  onMaterialChange: (value: string) => void
  onColorChange: (value: string) => void
}) {
  const selected = countertops.materials.find((material) => material.id === materialId)

  return (
    <>
      <Field label="Материал" value={selected?.name} hint={selected?.description}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {countertops.materials.map((material) => (
            <SelectCard
              key={material.id}
              name="countertop-material"
              value={material.id}
              checked={material.id === materialId}
              onSelect={onMaterialChange}
              title={material.name}
              caption={material.caption}
              preview={<SurfaceTile preview={material.preview} ratio="aspect-[5/3]" />}
            />
          ))}
        </div>
      </Field>

      <ColorSelector
        colors={countertops.colors}
        value={colorId}
        onChange={onColorChange}
        label="Цвет"
        name="countertop-color"
      />
    </>
  )
}
