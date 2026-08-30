import { AppError } from './errors'
import type { ProjectPhoto } from '@/types'

/** Максимальный размер исходного файла, который принимаем от пользователя. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Максимальная сторона подготовленного изображения. */
const MAX_EDGE = 1920

/** Целевой вес после подготовки — снимок с телефона не должен уезжать «как есть». */
const TARGET_BYTES = 1.6 * 1024 * 1024

const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62]

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation: снимки с телефона приходят с EXIF-поворотом.
      return await createImageBitmap(source, { imageOrientation: 'from-image' })
    } catch {
      /* переходим к запасному пути через <img> */
    }
  }

  const url = URL.createObjectURL(source)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new AppError('photo_unsupported'))
      image.src = url
    })
  } finally {
    // URL освобождаем после того, как картинка уже отрисована в canvas.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const sourceWidth = 'width' in source ? source.width : 0
  const sourceHeight = 'height' in source ? source.height : 0
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new AppError('photo_unsupported')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return { canvas, width, height }
}

/**
 * Проверяет, уменьшает и сжимает фотографию до разумного размера,
 * сохраняя приемлемое качество.
 */
export async function prepareProjectPhoto(file: File): Promise<ProjectPhoto> {
  if (!file.type.startsWith('image/')) throw new AppError('photo_unsupported')
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError('photo_too_large')

  const bitmap = await decode(file)
  const { canvas, width, height } = drawToCanvas(bitmap, MAX_EDGE)
  if ('close' in bitmap) bitmap.close()

  let dataUrl = canvas.toDataURL('image/jpeg', QUALITY_STEPS[0])
  for (const quality of QUALITY_STEPS.slice(1)) {
    if (estimateDataUrlBytes(dataUrl) <= TARGET_BYTES) break
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }

  return {
    dataUrl,
    width,
    height,
    sizeBytes: estimateDataUrlBytes(dataUrl),
    originalSizeBytes: file.size,
    fileName: file.name || 'photo.jpg',
    createdAt: new Date().toISOString(),
  }
}

/** Уменьшенная копия для карточек проектов и локального хранилища. */
export async function createThumbnail(dataUrl: string, maxEdge = 480): Promise<string> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const bitmap = await decode(blob)
  const { canvas } = drawToCanvas(bitmap, maxEdge)
  if ('close' in bitmap) bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

/** data URL → Blob для отправки на бэкенд как multipart/form-data. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

/** Сохраняет изображение по data URL в файл. */
export async function downloadImage(url: string, fileName: string): Promise<void> {
  const blob = url.startsWith('data:') ? await dataUrlToBlob(url) : await (await fetch(url)).blob()

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
}

/** Пытается поделиться изображением системным способом. */
export async function shareImage(url: string, fileName: string, title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return false
  try {
    const blob = url.startsWith('data:') ? await dataUrlToBlob(url) : await (await fetch(url)).blob()
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
    if ('canShare' in navigator && !navigator.canShare({ files: [file] })) {
      await navigator.share({ title })
      return true
    }
    await navigator.share({ title, files: [file] })
    return true
  } catch {
    return false
  }
}
