import { useState, type DragEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Перетаскивание файла — сценарий для десктопа. */
export function PhotoDropzone({
  onFile,
  children,
  className,
}: {
  onFile: (file: File) => void
  children: ReactNode
  className?: string
}) {
  const [over, setOver] = useState(false)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-2xl transition-colors duration-200',
        over && 'ring-2 ring-ink ring-offset-4 ring-offset-canvas',
        className,
      )}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-canvas/85 backdrop-blur-[1px]">
          <p className="text-[0.9375rem] font-medium text-ink">Отпустите — загрузим фотографию</p>
        </div>
      )}
    </div>
  )
}
