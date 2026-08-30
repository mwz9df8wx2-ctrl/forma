import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Share2, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const MIN_SCALE = 1
const MAX_SCALE = 4

/**
 * Полноэкранный просмотр результата: zoom колесом, двойным нажатием
 * и щипком двумя пальцами на телефоне.
 */
export function ImageViewer({
  src,
  caption,
  isDemo,
  onClose,
  onDownload,
  onShare,
  onPrev,
  onNext,
  downloading,
}: {
  src: string
  caption: string
  isDemo?: boolean
  onClose: () => void
  onDownload: () => void
  onShare: () => void
  onPrev?: () => void
  onNext?: () => void
  downloading?: boolean
}) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [interacting, setInteracting] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ distance: number; scale: number; offset: { x: number; y: number } } | null>(
    null,
  )

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onPrev?.()
      if (event.key === 'ArrowRight') onNext?.()
    }
    document.addEventListener('keydown', handleKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previous
    }
  }, [onClose, onPrev, onNext])

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    setInteracting(true)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        offset: { ...offset },
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const next = clampScale((gesture.current.scale * distance) / gesture.current.distance)
      setScale(next)
      if (next === 1) setOffset({ x: 0, y: 0 })
      return
    }

    if (pointers.current.size === 1 && scale > 1) {
      setOffset((current) => ({
        x: current.x + (event.clientX - previous.x),
        y: current.y + (event.clientY - previous.y),
      }))
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    if (pointers.current.size === 0) setInteracting(false)
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const next = clampScale(scale - event.deltaY * 0.0016)
    setScale(next)
    if (next === 1) setOffset({ x: 0, y: 0 })
  }

  const toggleZoom = () => {
    if (scale > 1) reset()
    else setScale(2.4)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0B0B0A] text-white">
      <div className="safe-top flex items-center justify-between gap-2 px-3 py-3">
        <IconButton
          label="Закрыть просмотр"
          onClick={onClose}
          variant="onDark"
        >
          <X className="size-5" />
        </IconButton>

        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[0.875rem] font-medium text-white/85">{caption}</p>
          {isDemo && (
            <Badge tone="inverse">Демо</Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton
            label="Поделиться"
            onClick={onShare}
            variant="onDark"
          >
            <Share2 className="size-5" />
          </IconButton>
          <IconButton
            label="Скачать изображение"
            onClick={onDownload}
            disabled={downloading}
            variant="onDark"
          >
            <Download className="size-5" />
          </IconButton>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={toggleZoom}
      >
        <img
          src={src}
          alt={caption}
          draggable={false}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transition: interacting ? 'none' : 'transform 200ms cubic-bezier(0.22,0.61,0.36,1)',
          }}
          className="max-h-full max-w-full select-none object-contain"
        />

        {onPrev && (
          <button
            type="button"
            aria-label="Предыдущий вариант"
            onClick={onPrev}
            className="absolute left-2 flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            aria-label="Следующий вариант"
            onClick={onNext}
            className="absolute right-2 flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      <p className="safe-bottom px-6 pt-2 pb-5 text-center text-xs text-white/45">
        Двойное нажатие или щипок двумя пальцами — увеличение
      </p>
    </div>
  )
}
