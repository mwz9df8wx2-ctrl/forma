import type { PhotoAnalysis } from './types.ts'

/**
 * Удаление существующей мебели со снимка.
 *
 * Новая кухня, положенная поверх старой, выдаёт себя по краям: из-под неё
 * торчат прежние фасады, ручки и техника. Поэтому перед вписыванием кадр
 * приводится к «пустой комнате»: всё, что не похоже на стену и пол, снимается
 * и закрашивается их продолжением.
 *
 * Это не нейросетевое дорисовывание, и оно этого не изображает. Работает по
 * простому признаку — цвет пикселя против цвета стены в том же столбце, —
 * и честно сообщает, когда признак не сработал: на пёстрых обоях или при
 * мебели в цвет стены разделить их так нельзя.
 */

/** Порог отличия от стены, при котором пиксель считается мебелью, 0..255. */
const DIFFERENCE_THRESHOLD = 26
/** Короче этого отрезка отметка считается шумом, доля ширины кадра. */
const MIN_RUN_SHARE = 0.008
/** Разрыв короче этого закрывается: щель между дверцами — не стена. */
const GAP_SHARE = 0.012

export interface ErasedPlate {
  pixels: Uint8ClampedArray
  /** Доля кадра, которую пришлось закрасить. */
  erasedShare: number
  /** Можно ли доверять разделению мебели и стены. */
  reliable: boolean
  reason: string | null
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

/** Средний цвет полосы строк для каждого столбца. */
function columnAverage(
  photo: Uint8ClampedArray,
  width: number,
  fromRow: number,
  toRow: number,
  fallback: [number, number, number],
): Float32Array {
  const result = new Float32Array(width * 3)
  const rows = Math.max(0, toRow - fromRow)
  for (let x = 0; x < width; x += 1) {
    if (rows === 0) {
      result[x * 3] = fallback[0]
      result[x * 3 + 1] = fallback[1]
      result[x * 3 + 2] = fallback[2]
      continue
    }
    let r = 0
    let g = 0
    let b = 0
    for (let y = fromRow; y < toRow; y += 1) {
      const o = (y * width + x) * 4
      r += photo[o]
      g += photo[o + 1]
      b += photo[o + 2]
    }
    result[x * 3] = r / rows
    result[x * 3 + 1] = g / rows
    result[x * 3 + 2] = b / rows
  }
  return result
}

/**
 * Отбраковка загрязнённых столбцов.
 *
 * Полоса, по которой строится модель, не всегда чистая: пенал достаёт до
 * потолка, мебель доходит до нижнего края кадра. Такие столбцы описывают
 * мебель, а не стену. Опорой берём медиану по столбцам, а не среднее:
 * среднее по полосе, наполовину занятой мебелью, оказывается ровно между
 * стеной и мебелью и не годится ни на что.
 *
 * Цвет из разбора кадра — только запасной вариант: он считается по всей
 * стене, включая закрытую мебелью часть, и на тесной кухне сам оказывается
 * цветом фасадов.
 */
function rejectOutliers(
  values: Float32Array,
  width: number,
  fallback: [number, number, number],
  usable: boolean,
): Float32Array {
  if (!usable) {
    const out = new Float32Array(values.length)
    for (let x = 0; x < width; x += 1) {
      out[x * 3] = fallback[0]
      out[x * 3 + 1] = fallback[1]
      out[x * 3 + 2] = fallback[2]
    }
    return out
  }

  const median = [0, 0, 0]
  for (let c = 0; c < 3; c += 1) {
    const channel: number[] = []
    for (let x = 0; x < width; x += 1) channel.push(values[x * 3 + c])
    channel.sort((a, b) => a - b)
    median[c] = channel[Math.floor(channel.length / 2)]
  }

  const distance = (a: number[], b: number[]) =>
    (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3

  const out = new Float32Array(values.length)
  for (let x = 0; x < width; x += 1) {
    const column = [values[x * 3], values[x * 3 + 1], values[x * 3 + 2]]
    const use = distance(column, median) > 45 ? median : column
    out[x * 3] = use[0]
    out[x * 3 + 1] = use[1]
    out[x * 3 + 2] = use[2]
  }
  return out
}

/** Сглаживание столбцов: одиночная тёмная колонка не должна задавать модель стены. */
function smoothColumns(values: Float32Array, width: number, radius: number): Float32Array {
  const out = new Float32Array(values.length)
  for (let x = 0; x < width; x += 1) {
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let dx = -radius; dx <= radius; dx += 1) {
      const sx = Math.min(width - 1, Math.max(0, x + dx))
      r += values[sx * 3]
      g += values[sx * 3 + 1]
      b += values[sx * 3 + 2]
      count += 1
    }
    out[x * 3] = r / count
    out[x * 3 + 1] = g / count
    out[x * 3 + 2] = b / count
  }
  return out
}

/** Закрытие коротких разрывов и удаление одиночных отметок в строке. */
function cleanRuns(mask: Uint8Array, width: number, height: number): void {
  const minRun = Math.max(3, Math.round(width * MIN_RUN_SHARE))
  const maxGap = Math.max(3, Math.round(width * GAP_SHARE))

  for (let y = 0; y < height; y += 1) {
    const row = y * width

    // Закрываем щели между дверцами и ручками.
    let x = 0
    while (x < width) {
      if (mask[row + x] === 1) {
        x += 1
        continue
      }
      const start = x
      while (x < width && mask[row + x] === 0) x += 1
      const bounded = start > 0 && x < width
      if (bounded && x - start <= maxGap) {
        for (let px = start; px < x; px += 1) mask[row + px] = 1
      }
    }

    // Убираем короткие отметки: это шум, а не мебель.
    x = 0
    while (x < width) {
      if (mask[row + x] === 0) {
        x += 1
        continue
      }
      const start = x
      while (x < width && mask[row + x] === 1) x += 1
      if (x - start < minRun) {
        for (let px = start; px < x; px += 1) mask[row + px] = 0
      }
    }
  }
}

/** Размытие маски: без него заплатка читается прямоугольником. */
function blurMask(mask: Uint8Array, width: number, height: number, radius: number): Float32Array {
  let current = Float32Array.from(mask)
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Float32Array(current.length)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0
        let count = 0
        for (let dy = -radius; dy <= radius; dy += 1) {
          const sy = Math.min(height - 1, Math.max(0, y + dy))
          for (let dx = -radius; dx <= radius; dx += 1) {
            const sx = Math.min(width - 1, Math.max(0, x + dx))
            sum += current[sy * width + sx]
            count += 1
          }
        }
        next[y * width + x] = sum / count
      }
    }
    current = next
  }
  return current
}

export function eraseFurniture(
  photo: Uint8ClampedArray,
  width: number,
  height: number,
  analysis: PhotoAnalysis,
): ErasedPlate {
  const out = new Uint8ClampedArray(photo)

  // Чистая полоса стены выше мебели — по ней строится модель стены.
  const bandTop = analysis.kitchenBand?.top ?? (analysis.ceilingLineY ?? 0.06) + 0.04
  const top = Math.max(0, Math.min(height - 8, Math.round(bandTop * height)))
  if (top < 4) {
    return {
      pixels: out,
      erasedShare: 0,
      reliable: false,
      reason: 'на снимке не видно чистой стены выше мебели',
    }
  }

  const wallAnchor = parseHex(analysis.colors.wall)
  const floorAnchor = parseHex(analysis.colors.floor)

  // Чистая полоса стены — между линией потолка и верхом мебели.
  const wallFrom = Math.max(
    0,
    analysis.ceilingLineY !== null ? Math.round(analysis.ceilingLineY * height) + 2 : top - 12,
  )
  const wallTo = Math.max(wallFrom, top - 2)
  const wall = smoothColumns(
    rejectOutliers(
      columnAverage(photo, width, wallFrom, wallTo, wallAnchor),
      width,
      wallAnchor,
      wallTo - wallFrom >= 4,
    ),
    width,
    Math.max(2, Math.round(width * 0.02)),
  )

  const floorFrom = Math.max(0, height - Math.round(height * 0.05))
  const floor = smoothColumns(
    rejectOutliers(
      columnAverage(photo, width, floorFrom, height, floorAnchor),
      width,
      floorAnchor,
      height - floorFrom >= 4,
    ),
    width,
    Math.max(2, Math.round(width * 0.03)),
  )

  const floorLine = analysis.floorLineY !== null ? analysis.floorLineY * height : height * 0.78

  // Окна не трогаем: они ярче стены и иначе были бы стёрты как мебель.
  const protectedMask = new Uint8Array(width * height)
  for (const win of analysis.windows) {
    const x0 = Math.max(0, Math.floor(win.x0 * width) - 2)
    const x1 = Math.min(width, Math.ceil(win.x1 * width) + 2)
    const y0 = Math.max(0, Math.floor(win.y0 * height) - 2)
    const y1 = Math.min(height, Math.ceil(win.y1 * height) + 2)
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) protectedMask[y * width + x] = 1
    }
  }

  const mask = new Uint8Array(width * height)

  // Нижний ряд — единственное место кадра, где мебель есть наверняка:
  // именно по его кромке разбор нашёл линию столешницы. Здесь не гадаем
  // по цвету, а снимаем всю полосу: белый фасад на белой стене цветом
  // не отделяется, а снять его всё равно надо.
  if (analysis.counterLineY !== null && analysis.counterSpan !== null) {
    const runTop = Math.max(top, Math.round((analysis.counterLineY - 0.02) * height))
    const runBottom = Math.min(height, Math.round((analysis.floorLineY ?? 0.8) * height + height * 0.12))
    const runLeft = Math.max(0, Math.round((analysis.counterSpan.left - 0.01) * width))
    const runRight = Math.min(width, Math.round((analysis.counterSpan.right + 0.01) * width))

    // Прежде чем снимать полосу целиком, убеждаемся, что там вообще есть
    // мебель: линию столешницы разбор мог принять за плинтус или стол,
    // и тогда мы закрасили бы живую стену.
    let different = 0
    let total = 0
    for (let y = runTop; y < runBottom; y += 1) {
      for (let x = runLeft; x < runRight; x += 1) {
        const o = (y * width + x) * 4
        const dWall =
          Math.abs(photo[o] - wall[x * 3]) +
          Math.abs(photo[o + 1] - wall[x * 3 + 1]) +
          Math.abs(photo[o + 2] - wall[x * 3 + 2])
        const dFloor =
          Math.abs(photo[o] - floor[x * 3]) +
          Math.abs(photo[o + 1] - floor[x * 3 + 1]) +
          Math.abs(photo[o + 2] - floor[x * 3 + 2])
        if (Math.min(dWall, dFloor) / 3 > DIFFERENCE_THRESHOLD * 0.7) different += 1
        total += 1
      }
    }

    if (total > 0 && different / total > 0.1) {
      const isFurniture = (x: number, y: number) => {
        const o = (y * width + x) * 4
        const dWall =
          Math.abs(photo[o] - wall[x * 3]) +
          Math.abs(photo[o + 1] - wall[x * 3 + 1]) +
          Math.abs(photo[o + 2] - wall[x * 3 + 2])
        const dFloor =
          Math.abs(photo[o] - floor[x * 3]) +
          Math.abs(photo[o + 1] - floor[x * 3 + 1]) +
          Math.abs(photo[o + 2] - floor[x * 3 + 2])
        return Math.min(dWall, dFloor) / 3 > DIFFERENCE_THRESHOLD * 0.7
      }

      // Разбор находит столешницу по её самой контрастной части и обычно
      // не дотягивает до краёв. Продлеваем ряд в обе стороны, пока строка
      // не похожа на стену: так снимаются крайние секции, которые иначе
      // торчат из-под новой кухни.
      const tolerance = Math.max(2, Math.round(width * 0.02))
      for (let y = runTop; y < runBottom; y += 1) {
        let leftEdge = runLeft
        let misses = 0
        for (let x = runLeft - 1; x >= 0; x -= 1) {
          if (isFurniture(x, y)) {
            leftEdge = x
            misses = 0
          } else if (++misses > tolerance) break
        }

        let rightEdge = runRight
        misses = 0
        for (let x = runRight; x < width; x += 1) {
          if (isFurniture(x, y)) {
            rightEdge = x + 1
            misses = 0
          } else if (++misses > tolerance) break
        }

        for (let x = leftEdge; x < rightEdge; x += 1) {
          const index = y * width + x
          if (protectedMask[index] === 1) continue
          mask[index] = 1
        }
      }
    }
  }

  for (let y = top; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (mask[index] === 1 || protectedMask[index] === 1) continue
      const o = index * 4
      const r = photo[o]
      const g = photo[o + 1]
      const b = photo[o + 2]

      const dWall =
        Math.abs(r - wall[x * 3]) + Math.abs(g - wall[x * 3 + 1]) + Math.abs(b - wall[x * 3 + 2])
      const dFloor =
        Math.abs(r - floor[x * 3]) + Math.abs(g - floor[x * 3 + 1]) + Math.abs(b - floor[x * 3 + 2])

      if (Math.min(dWall, dFloor) / 3 > DIFFERENCE_THRESHOLD) mask[index] = 1
    }
  }

  cleanRuns(mask, width, height)

  /**
   * Смыкание верхнего ряда.
   *
   * У навесных шкафов цветом надёжно ловятся только тени и щели между
   * дверцами — сами фасады часто в тон стене. Но если в строке набралось
   * достаточно отметок, между крайними из них мебель есть по всей длине:
   * ряд навесных шкафов не бывает дырявым.
   */
  const upperBottom = Math.round((analysis.counterLineY ?? 0.6) * height)
  for (let y = top; y < upperBottom; y += 1) {
    const row = y * width
    let first = -1
    let last = -1
    let count = 0
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x] === 0) continue
      if (first < 0) first = x
      last = x
      count += 1
    }
    if (first < 0 || last - first < width * 0.08) continue
    if (count / (last - first + 1) < 0.4) continue
    for (let x = first; x <= last; x += 1) {
      if (protectedMask[row + x] === 1) continue
      mask[row + x] = 1
    }
  }

  let marked = 0
  for (let i = 0; i < mask.length; i += 1) marked += mask[i]
  const erasedShare = marked / (width * height)

  // Закрасили почти весь кадр — значит модель стены не описывает эту стену.
  // Лучше оставить снимок как есть, чем залить его ровным пятном.
  if (erasedShare > 0.6) {
    return {
      pixels: out,
      erasedShare,
      reliable: false,
      reason: 'мебель не отделяется от стены: слишком пёстрый или тёмный кадр',
    }
  }

  const soft = blurMask(mask, width, height, Math.max(1, Math.round(width * 0.004)))

  /**
   * Заливка вертикальной протяжкой.
   *
   * Для каждого столбца берём ближайшие живые пиксели сверху и снизу и
   * растягиваем между ними. Так сама собой сохраняется вертикальная тень —
   * у потолка темнее, у окна светлее, — которую единый «цвет стены» стирает
   * в ровное пятно, и заплатка сразу читается как заплатка.
   */
  const above = new Int32Array(width * height).fill(-1)
  const below = new Int32Array(width * height).fill(-1)
  for (let x = 0; x < width; x += 1) {
    let last = -1
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x
      above[index] = last
      if (mask[index] === 0) last = y
    }
    last = -1
    for (let y = height - 1; y >= 0; y -= 1) {
      const index = y * width + x
      below[index] = last
      if (mask[index] === 0) last = y
    }
  }

  for (let y = top; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const strength = soft[index]
      if (strength < 0.02) continue

      const yAbove = above[index]
      const yBelow = below[index]
      // Лёгкий шум: идеально ровная заливка выглядит нарисованной.
      const grain = ((x * 7919 + y * 104729) % 11) / 11 - 0.5
      const o = index * 4

      for (let c = 0; c < 3; c += 1) {
        let fill: number
        if (yAbove >= 0 && yBelow >= 0) {
          const t = (y - yAbove) / (yBelow - yAbove)
          const top = photo[(yAbove * width + x) * 4 + c]
          const bottom = photo[(yBelow * width + x) * 4 + c]
          fill = top + (bottom - top) * t
        } else if (yAbove >= 0) {
          fill = photo[(yAbove * width + x) * 4 + c]
        } else if (yBelow >= 0) {
          fill = photo[(yBelow * width + x) * 4 + c]
        } else {
          // Живых пикселей в столбце не осталось — опираемся на модели.
          const blend = Math.min(1, Math.max(0, (y - floorLine) / Math.max(4, height * 0.02)))
          fill = wall[x * 3 + c] * (1 - blend) + floor[x * 3 + c] * blend
        }
        out[o + c] = photo[o + c] * (1 - strength) + (fill + grain * 3) * strength
      }
    }
  }

  return {
    pixels: out,
    erasedShare,
    reliable: true,
    reason: null,
  }
}
