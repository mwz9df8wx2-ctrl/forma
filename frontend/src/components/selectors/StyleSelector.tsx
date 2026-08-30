import { SelectCard } from '@/components/ui/SelectCard'
import type { Style } from '@/types'

/** Схематичная сцена интерьера в цветах стиля. */
function StyleScene({ preview }: { preview: Style['preview'] }) {
  return (
    <div
      aria-hidden
      className="relative h-[72px] w-[104px] overflow-hidden rounded-lg border border-black/5"
      style={{ background: preview.wall }}
    >
      <div
        className="absolute top-[14%] left-[8%] h-[24%] w-[48%] rounded-[2px]"
        style={{ background: preview.facade }}
      />
      <div
        className="absolute top-[14%] right-[8%] h-[24%] w-[28%] rounded-[2px] opacity-90"
        style={{ background: preview.accent }}
      />
      <div
        className="absolute inset-x-[6%] top-[54%] h-[7%] rounded-[2px]"
        style={{ background: preview.counter }}
      />
      <div
        className="absolute inset-x-[6%] top-[61%] bottom-[14%] rounded-[2px]"
        style={{ background: preview.facade }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[14%] opacity-40"
        style={{ background: preview.accent }}
      />
    </div>
  )
}

export function StyleSelector({
  styles,
  value,
  onChange,
}: {
  styles: Style[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
        {styles.map((style) => (
          <SelectCard
            key={style.id}
            name="style"
            value={style.id}
            checked={style.id === value}
            onSelect={onChange}
            layout="row"
            title={style.name}
            description={style.description}
            preview={<StyleScene preview={style.preview} />}
          />
      ))}
    </div>
  )
}
