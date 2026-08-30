import { useEffect, useRef, useState } from 'react'
import { Camera, Images, SwitchCamera, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { useCamera } from '@/hooks/useCamera'

/**
 * Минимальная камера на штатных возможностях браузера.
 * Область просмотра, кнопка затвора, подсказка и отмена — ничего лишнего.
 */
export function CameraView({
  onCapture,
  onCancel,
  onPickFromGallery,
}: {
  onCapture: (file: File) => void
  onCancel: () => void
  onPickFromGallery: () => void
}) {
  const { videoRef, status, error, start, stop, capture, switchCamera } = useCamera()
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
    return () => stop()
  }, [start, stop])

  const handleShutter = async () => {
    if (busy || status !== 'ready') return
    setBusy(true)
    try {
      const file = await capture()
      stop()
      onCapture(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0C0C0B] text-white">
      <div className="safe-top flex items-center justify-between px-4 py-3">
        <IconButton
          label="Отменить съёмку"
          onClick={() => {
            stop()
            onCancel()
          }}
          variant="onDark"
        >
          <X className="size-5" />
        </IconButton>
        <p className="text-[0.8125rem] font-medium text-white/70">Съёмка кухни</p>
        <IconButton
          label="Переключить камеру"
          onClick={() => void switchCamera()}
          disabled={status !== 'ready'}
          variant="onDark"
        >
          <SwitchCamera className="size-5" />
        </IconButton>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Изображение с камеры"
          className="size-full object-cover"
        />

        {status === 'ready' && (
          <div aria-hidden className="pointer-events-none absolute inset-6">
            {[
              'left-0 top-0 border-l-2 border-t-2',
              'right-0 top-0 border-r-2 border-t-2',
              'left-0 bottom-0 border-l-2 border-b-2',
              'right-0 bottom-0 border-r-2 border-b-2',
            ].map((position) => (
              <span key={position} className={`absolute size-10 border-white/45 ${position}`} />
            ))}
          </div>
        )}

        {status === 'starting' && (
          <p className="absolute text-[0.9375rem] text-white/70">Включаем камеру…</p>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <Camera aria-hidden className="size-8 text-white/50" />
            <div>
              <p className="text-base font-medium">{error?.message}</p>
              <p className="mt-2 text-[0.875rem] text-white/60">
                Можно выбрать готовую фотографию из галереи телефона.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2.5">
              <Button
                variant="light"
                size="lg"
                fullWidth
                icon={<Images />}
                onClick={() => {
                  stop()
                  onPickFromGallery()
                }}
              >
                Выбрать из галереи
              </Button>
              <Button
                variant="outlineLight"
                size="md"
                fullWidth
                onClick={() => {
                  stop()
                  onCancel()
                }}
              >
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="safe-bottom px-6 pt-5 pb-6">
        <p className="mb-5 text-center text-[0.875rem] leading-snug text-white/70">
          Встаньте напротив кухни и снимайте фронтально, не под углом. В кадр должна
          попасть вся стена — от пола до потолка.
        </p>
        <div className="flex items-center justify-center gap-8">
          <IconButton
            label="Выбрать из галереи"
            onClick={() => {
              stop()
              onPickFromGallery()
            }}
            variant="onDark"
          >
            <Images className="size-5" />
          </IconButton>

          <button
            type="button"
            onClick={() => void handleShutter()}
            disabled={status !== 'ready' || busy}
            aria-label="Сделать снимок"
            className="flex size-[76px] shrink-0 items-center justify-center rounded-full border-[3px] border-white/90 transition-transform duration-200 active:scale-95 disabled:opacity-40"
          >
            <span className="size-[60px] rounded-full bg-white transition-transform duration-200" />
          </button>

          <span aria-hidden className="size-11" />
        </div>
      </div>
    </div>
  )
}
