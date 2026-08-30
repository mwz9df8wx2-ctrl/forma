import { useCallback, useEffect, useRef, useState } from 'react'
import { AppError } from '@/lib/errors'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'
export type CameraFacing = 'environment' | 'user'

/** Поддерживает ли браузер съёмку через getUserMedia. */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    (window.isSecureContext || location.hostname === 'localhost')
  )
}

/**
 * Съёмка через штатные возможности браузера.
 * На телефоне по умолчанию запрашивается задняя камера.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<AppError | null>(null)
  const [facing, setFacing] = useState<CameraFacing>('environment')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(
    async (nextFacing: CameraFacing = facing) => {
      if (!isCameraSupported()) {
        setStatus('error')
        setError(new AppError('camera_unavailable'))
        return false
      }

      setStatus('starting')
      setError(null)
      streamRef.current?.getTracks().forEach((track) => track.stop())

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setFacing(nextFacing)
        setStatus('ready')
        return true
      } catch (cause) {
        const denied =
          cause instanceof DOMException &&
          (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
        setError(new AppError(denied ? 'camera_denied' : 'camera_unavailable'))
        setStatus('error')
        return false
      }
    },
    [facing],
  )

  const switchCamera = useCallback(async () => {
    await start(facing === 'environment' ? 'user' : 'environment')
  }, [facing, start])

  /** Кадр из видеопотока в файл — дальше он проходит обычную подготовку изображения. */
  const capture = useCallback(async (): Promise<File> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) throw new AppError('camera_unavailable')

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) throw new AppError('camera_unavailable')
    if (facing === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) throw new AppError('camera_unavailable')

    return new File([blob], `kitchen-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }, [facing])

  useEffect(() => () => stop(), [stop])

  return { videoRef, status, error, facing, start, stop, capture, switchCamera }
}
