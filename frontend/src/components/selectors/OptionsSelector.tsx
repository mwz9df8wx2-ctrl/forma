import { Switch } from '@/components/ui/Switch'
import type { OptionValues, ProjectOption } from '@/types'

const GROUP_TITLES: Record<ProjectOption['group'], string> = {
  preserve: 'Сохранить с фотографии',
  add: 'Добавить в проект',
}

export function OptionsSelector({
  options,
  values,
  onChange,
}: {
  options: ProjectOption[]
  values: OptionValues
  onChange: (id: string, value: boolean) => void
}) {
  const groups: ProjectOption['group'][] = ['preserve', 'add']

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {groups.map((group) => {
        const items = options.filter((option) => option.group === group)
        if (items.length === 0) return null
        return (
          <fieldset key={group} className="min-w-0">
            <legend className="mb-1.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
              {GROUP_TITLES[group]}
            </legend>
            <div className="divide-y divide-line">
              {items.map((option) => (
                <Switch
                  key={option.id}
                  checked={values[option.id] === true}
                  onChange={(checked) => onChange(option.id, checked)}
                  label={option.name}
                  description={option.description}
                />
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
