/** Совмещение отрисованной кухни с настоящей фотографией. */

function srgbToLinear(channel: number): number {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/** Средняя линейная яркость снимка там, где кухня перекрывает кадр. */
export function measurePhotoLuminance(
  photo: Uint8ClampedArray,
  alpha: Float32Array,
  threshold = 0.5,
): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < alpha.length; i += 1) {
    if (alpha[i] < threshold) continue
    const o = i * 4
    sum +=
      0.2126 * srgbToLinear(photo[o]) +
      0.7152 * srgbToLinear(photo[o + 1]) +
      0.0722 * srgbToLinear(photo[o + 2])
    count += 1
  }
  return count > 0 ? sum / count : 0.18
}

/** Средняя яркость отрисованной кухни в том же месте кадра. */
export function measureRenderLuminance(
  color: Float32Array,
  alpha: Float32Array,
  threshold = 0.5,
): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < alpha.length; i += 1) {
    if (alpha[i] < threshold) continue
    const o = i * 3
    sum += 0.2126 * color[o] + 0.7152 * color[o + 1] + 0.0722 * color[o + 2]
    count += 1
  }
  return count > 0 ? sum / count : 0.18
}

/**
 * Накладывает кадр с альфой на фотографию.
 * Тень приходит чёрным цветом с частичной альфой, поэтому тем же действием
 * затемняет реальный пол.
 */
export function compositeOverPhoto(
  photo: Uint8ClampedArray,
  render: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    const a = render[o + 3] / 255
    const inverse = 1 - a
    out[o] = render[o] * a + photo[o] * inverse
    out[o + 1] = render[o + 1] * a + photo[o + 1] * inverse
    out[o + 2] = render[o + 2] * a + photo[o + 2] * inverse
    out[o + 3] = 255
  }
  return out
}

/**
 * Заделывает просветы между новыми модулями, где на снимке видна старая кухня.
 *
 * Правим только разрывы, замкнутые новой мебелью слева и справа: так остатки
 * прежних фасадов исчезают, а настоящая обстановка комнаты остаётся нетронутой.
 */
export function repairUncoveredGaps(
  photo: Uint8ClampedArray,
  alpha: Float32Array,
  width: number,
  height: number,
  band: { top: number; bottom: number },
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(photo)
  const top = Math.max(1, Math.floor(band.top * height))
  const bottom = Math.min(height - 1, Math.ceil(band.bottom * height))
  const maxGap = Math.round(width * 0.25)

  // Цвет стены берём над зоной кухни, отдельно для каждого столбца:
  // так сохраняется естественный перепад освещённости по кадру.
  const sourceRow = Math.max(0, top - 6)
  const columnColor = new Float32Array(width * 3)
  for (let x = 0; x < width; x += 1) {
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let y = Math.max(0, sourceRow - 4); y <= sourceRow; y += 1) {
      const o = (y * width + x) * 4
      r += photo[o]
      g += photo[o + 1]
      b += photo[o + 2]
      count += 1
    }
    columnColor[x * 3] = r / count
    columnColor[x * 3 + 1] = g / count
    columnColor[x * 3 + 2] = b / count
  }

  for (let y = top; y < bottom; y += 1) {
    let x = 0
    while (x < width) {
      if (alpha[y * width + x] >= 0.5) {
        x += 1
        continue
      }
      const start = x
      while (x < width && alpha[y * width + x] < 0.5) x += 1
      const end = x

      const boundedLeft = start > 0
      const boundedRight = end < width
      if (!boundedLeft || !boundedRight || end - start > maxGap) continue

      for (let px = start; px < end; px += 1) {
        // Плавный край, чтобы заплатка не читалась прямоугольником.
        const edge = Math.min(px - start, end - 1 - px)
        const feather = Math.min(1, (edge + 1) / 4)
        const o = (y * width + px) * 4
        const wallR = columnColor[px * 3]
        const wallG = columnColor[px * 3 + 1]
        const wallB = columnColor[px * 3 + 2]
        out[o] = photo[o] + (wallR - photo[o]) * feather
        out[o + 1] = photo[o + 1] + (wallG - photo[o + 1]) * feather
        out[o + 2] = photo[o + 2] + (wallB - photo[o + 2]) * feather
      }
    }
  }

  return out
}

/** Доля кадра, занятая кухней. Нужна для проверки осмысленности результата. */
export function coverage(alpha: Float32Array, threshold = 0.5): number {
  let count = 0
  for (let i = 0; i < alpha.length; i += 1) if (alpha[i] >= threshold) count += 1
  return count / alpha.length
}
