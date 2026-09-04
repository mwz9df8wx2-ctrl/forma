/**
 * Маска замены для провайдера изображений.
 *
 * Формат задан провайдером: PNG того же размера, что и снимок, где
 * прозрачные пиксели — область, которую разрешено перерисовать. Всё
 * непрозрачное провайдер обязан оставить как есть.
 *
 * Маску строим из того же расчёта, которым локальный движок снимает прежнюю
 * мебель. Считать её вторым способом значило бы получить две разные области
 * замены — и разный результат в зависимости от того, есть ли ключ провайдера.
 */

/** Запас вокруг снятой мебели: у провайдера должно быть чем растушевать край. */
const DILATE_STEPS = 2

function dilate(mask: Uint8Array, width: number, height: number, steps: number): Uint8Array {
  let current = mask
  for (let pass = 0; pass < steps; pass += 1) {
    const next = new Uint8Array(current.length)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (current[index] === 1) {
          next[index] = 1
          continue
        }
        const up = y > 0 && current[index - width] === 1
        const down = y < height - 1 && current[index + width] === 1
        const left = x > 0 && current[index - 1] === 1
        const right = x < width - 1 && current[index + 1] === 1
        if (up || down || left || right) next[index] = 1
      }
    }
    current = next
  }
  return current
}

/**
 * PNG-маска замены. Возвращает null, если браузер не даёт холст —
 * тогда запрос уйдёт без маски, и это лучше, чем сорвать генерацию.
 */
export async function buildReplacementMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Promise<Blob | null> {
  const grown = dilate(mask, width, height, DILATE_STEPS)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(width, height)
  for (let i = 0; i < grown.length; i += 1) {
    const o = i * 4
    // Цвет неважен, значение имеет только альфа: ноль — перерисовать.
    image.data[o] = 255
    image.data[o + 1] = 255
    image.data[o + 2] = 255
    image.data[o + 3] = grown[i] === 1 ? 0 : 255
  }
  context.putImageData(image, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/** Пиксели снимка из data URL — нужны и разбору, и маске. */
export async function decodePhoto(
  dataUrl: string,
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number } | null> {
  const image = new Image()
  image.src = dataUrl
  try {
    await image.decode()
  } catch {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0)
  const data = context.getImageData(0, 0, canvas.width, canvas.height)
  return { pixels: data.data, width: canvas.width, height: canvas.height }
}
