import type { DetectedWindow, PhotoAnalysis } from './types.ts'

/**
 * Разбор фотографии помещения перед визуализацией.
 *
 * Задача — понять геометрию и свет реальной комнаты, чтобы построенная кухня
 * встала в кадр по той же перспективе и с тем же освещением. Никакой нейросети
 * здесь нет: только градиенты, проекции и статистика по пикселям, поэтому
 * результат предсказуем и считается за доли секунды.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

interface Buffers {
  width: number
  height: number
  luma: Float32Array
  gx: Float32Array
  gy: Float32Array
  magnitude: Float32Array
  rgb: Uint8ClampedArray
}

function toBuffers(pixels: Uint8ClampedArray, width: number, height: number): Buffers {
  const size = width * height
  const luma = new Float32Array(size)
  for (let i = 0; i < size; i += 1) {
    const o = i * 4
    luma[i] = (0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]) / 255
  }

  const gx = new Float32Array(size)
  const gy = new Float32Array(size)
  const magnitude = new Float32Array(size)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x
      const tl = luma[i - width - 1]
      const tc = luma[i - width]
      const tr = luma[i - width + 1]
      const ml = luma[i - 1]
      const mr = luma[i + 1]
      const bl = luma[i + width - 1]
      const bc = luma[i + width]
      const br = luma[i + width + 1]

      const sx = tr + 2 * mr + br - (tl + 2 * ml + bl)
      const sy = bl + 2 * bc + br - (tl + 2 * tc + tr)
      gx[i] = sx
      gy[i] = sy
      magnitude[i] = Math.hypot(sx, sy)
    }
  }

  return { width, height, luma, gx, gy, magnitude, rgb: pixels }
}

/** Сумма горизонтальных перепадов по строкам — так проявляются стыки пола и потолка. */
function rowProfile(buffers: Buffers): Float32Array {
  const { width, height, gy } = buffers
  const profile = new Float32Array(height)
  for (let y = 0; y < height; y += 1) {
    let sum = 0
    for (let x = 0; x < width; x += 1) sum += Math.abs(gy[y * width + x])
    profile[y] = sum / width
  }
  return smooth(profile, 3)
}

function columnProfile(buffers: Buffers): Float32Array {
  const { width, height, gx } = buffers
  const profile = new Float32Array(width)
  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let y = 0; y < height; y += 1) sum += Math.abs(gx[y * width + x])
    profile[x] = sum / height
  }
  return smooth(profile, 3)
}

function smooth(values: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(values.length)
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0
    let count = 0
    for (let k = -radius; k <= radius; k += 1) {
      const j = i + k
      if (j < 0 || j >= values.length) continue
      sum += values[j]
      count += 1
    }
    out[i] = sum / count
  }
  return out
}

/** Самый выраженный пик профиля в заданном диапазоне. */
function findPeak(
  profile: Float32Array,
  from: number,
  to: number,
): { index: number; strength: number } | null {
  let best = -1
  let bestValue = 0
  let mean = 0
  let count = 0

  for (let i = from; i < to; i += 1) {
    mean += profile[i]
    count += 1
    if (profile[i] > bestValue) {
      bestValue = profile[i]
      best = i
    }
  }
  if (best < 0 || count === 0) return null
  mean /= count
  // Пик считается значимым, только если заметно выше среднего фона.
  const strength = mean > 0 ? clamp01((bestValue / mean - 1.35) / 1.6) : 0
  return { index: best, strength }
}

/**
 * Точка схода: уходящие вглубь линии (стыки стен, кромки шкафов) пересекаются
 * в одной точке. Берём наклонные края и копим пересечения случайных пар.
 */
function findVanishingPoint(
  buffers: Buffers,
): { x: number; y: number; confidence: number } | null {
  const { width, height, gx, gy, magnitude } = buffers
  const points: number[] = []
  const threshold = 0.55

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const i = y * width + x
      if (magnitude[i] < threshold) continue
      // Направление самой линии перпендикулярно градиенту.
      const angle = Math.atan2(-gx[i], gy[i])
      const degrees = Math.abs((angle * 180) / Math.PI) % 180
      const fromHorizontal = Math.min(degrees, 180 - degrees)
      const fromVertical = Math.abs(degrees - 90)
      // Нас интересуют только наклонные линии: 8°…40° от горизонтали.
      if (fromHorizontal < 8 || fromHorizontal > 40 || fromVertical < 25) continue
      points.push(x, y, Math.cos(angle), Math.sin(angle))
    }
  }

  const count = points.length / 4
  if (count < 24) return null

  // Аккумулятор покрывает кадр с запасом: точка схода часто вне снимка.
  const cells = 48
  const spanX = width * 3
  const spanY = height * 3
  const offsetX = width
  const offsetY = height
  const accumulator = new Float32Array(cells * cells)

  const pairs = Math.min(12000, count * 12)
  let seed = 1
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let p = 0; p < pairs; p += 1) {
    const a = Math.floor(random() * count) * 4
    const b = Math.floor(random() * count) * 4
    if (a === b) continue

    const x1 = points[a]
    const y1 = points[a + 1]
    const dx1 = points[a + 2]
    const dy1 = points[a + 3]
    const x2 = points[b]
    const y2 = points[b + 1]
    const dx2 = points[b + 2]
    const dy2 = points[b + 3]

    const denominator = dx1 * dy2 - dy1 * dx2
    if (Math.abs(denominator) < 0.12) continue

    const t = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / denominator
    const ix = x1 + dx1 * t
    const iy = y1 + dy1 * t

    const cx = Math.floor(((ix + offsetX) / spanX) * cells)
    const cy = Math.floor(((iy + offsetY) / spanY) * cells)
    if (cx < 0 || cy < 0 || cx >= cells || cy >= cells) continue
    accumulator[cy * cells + cx] += 1
  }

  let bestIndex = -1
  let bestValue = 0
  let total = 0
  for (let i = 0; i < accumulator.length; i += 1) {
    total += accumulator[i]
    if (accumulator[i] > bestValue) {
      bestValue = accumulator[i]
      bestIndex = i
    }
  }
  if (bestIndex < 0 || total < 60) return null

  const peakX = bestIndex % cells
  const peakY = Math.floor(bestIndex / cells)

  // Уточняем положение центром масс по соседним ячейкам: сетка грубая,
  // и пик почти всегда размазан на несколько клеток.
  let weight = 0
  let sumX = 0
  let sumY = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = peakX + dx
      const ny = peakY + dy
      if (nx < 0 || ny < 0 || nx >= cells || ny >= cells) continue
      const value = accumulator[ny * cells + nx]
      weight += value
      sumX += (nx + 0.5) * value
      sumY += (ny + 0.5) * value
    }
  }
  if (weight === 0) return null

  const x = (sumX / weight / cells) * spanX - offsetX
  const y = (sumY / weight / cells) * spanY - offsetY

  // Доверие — доля голосов, собранных окрестностью пика.
  const share = weight / total
  return { x, y, confidence: clamp01((share - 0.05) / 0.3) }
}

/** Пересвеченные однородные области — почти всегда окна. */
function findWindows(buffers: Buffers, frameMeanLuma: number): DetectedWindow[] {
  const { width, height, luma, magnitude } = buffers
  const cellSize = 8
  const cols = Math.ceil(width / cellSize)
  const rows = Math.ceil(height / cellSize)
  const bright = new Uint8Array(cols * rows)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let sum = 0
      let edge = 0
      let count = 0
      for (let y = row * cellSize; y < Math.min(height, (row + 1) * cellSize); y += 1) {
        for (let x = col * cellSize; x < Math.min(width, (col + 1) * cellSize); x += 1) {
          const i = y * width + x
          sum += luma[i]
          edge += magnitude[i]
          count += 1
        }
      }
      if (count === 0) continue
      const meanLuma = sum / count
      const meanEdge = edge / count
      // Окно заметно ярче кадра в целом, а не просто светлая поверхность.
      const isBright = meanLuma > Math.max(0.78, frameMeanLuma + 0.26) && meanEdge < 0.9
      bright[row * cols + col] = isBright ? 1 : 0
    }
  }

  const visited = new Uint8Array(cols * rows)
  const windows: DetectedWindow[] = []
  const stack: number[] = []

  for (let start = 0; start < bright.length; start += 1) {
    if (bright[start] === 0 || visited[start] === 1) continue
    stack.length = 0
    stack.push(start)
    visited[start] = 1

    let minCol = cols
    let maxCol = 0
    let minRow = rows
    let maxRow = 0
    let area = 0

    while (stack.length > 0) {
      const index = stack.pop() as number
      const col = index % cols
      const row = Math.floor(index / cols)
      area += 1
      if (col < minCol) minCol = col
      if (col > maxCol) maxCol = col
      if (row < minRow) minRow = row
      if (row > maxRow) maxRow = row

      const neighbours = [index - 1, index + 1, index - cols, index + cols]
      for (const next of neighbours) {
        if (next < 0 || next >= bright.length || visited[next] === 1 || bright[next] === 0) continue
        // Не перескакиваем через край строки.
        if (Math.abs((next % cols) - col) > 1) continue
        visited[next] = 1
        stack.push(next)
      }
    }

    const areaShare = area / (cols * rows)
    if (areaShare < 0.006) continue

    const boxWidth = (maxCol - minCol + 1) / cols
    const boxHeight = (maxRow - minRow + 1) / rows
    const fill = area / ((maxCol - minCol + 1) * (maxRow - minRow + 1))
    // Окно — компактная заполненная область, а не тонкий блик вдоль кромки
    // и не сплошная засветка потолка во всю ширину кадра.
    const strength = clamp01(fill * 1.2 - 0.2) * clamp01(areaShare * 12)
    const spansFrame = boxWidth > 0.86 && boxHeight < 0.2
    if (strength < 0.15 || boxWidth < 0.04 || boxHeight < 0.04 || spansFrame) continue

    windows.push({
      x0: minCol / cols,
      y0: minRow / rows,
      x1: (maxCol + 1) / cols,
      y1: (maxRow + 1) / rows,
      strength,
    })
  }

  return windows
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((window) => refineWindowBox(buffers, window))
}

/**
 * Уточнение границ окна по яркости.
 *
 * Засветка даёт ореол вокруг проёма, и грубая сетка захватывает лишнее.
 * Если этого не убрать, мебель разрежется шире настоящего окна и в кадре
 * останутся куски прежней кухни.
 */
function refineWindowBox(buffers: Buffers, window: DetectedWindow): DetectedWindow {
  const { width, height, luma } = buffers
  const x0 = Math.max(0, Math.floor(window.x0 * width))
  const x1 = Math.min(width, Math.ceil(window.x1 * width))
  const y0 = Math.max(0, Math.floor(window.y0 * height))
  const y1 = Math.min(height, Math.ceil(window.y1 * height))
  if (x1 - x0 < 6 || y1 - y0 < 6) return window

  const columnMean = new Float32Array(x1 - x0)
  for (let x = x0; x < x1; x += 1) {
    let sum = 0
    for (let y = y0; y < y1; y += 1) sum += luma[y * width + x]
    columnMean[x - x0] = sum / (y1 - y0)
  }
  const rowMean = new Float32Array(y1 - y0)
  for (let y = y0; y < y1; y += 1) {
    let sum = 0
    for (let x = x0; x < x1; x += 1) sum += luma[y * width + x]
    rowMean[y - y0] = sum / (x1 - x0)
  }

  const peak = (values: Float32Array) => values.reduce((max, value) => Math.max(max, value), 0)
  const trough = (values: Float32Array) => values.reduce((min, value) => Math.min(min, value), 1)
  const columnThreshold = trough(columnMean) + (peak(columnMean) - trough(columnMean)) * 0.62
  const rowThreshold = trough(rowMean) + (peak(rowMean) - trough(rowMean)) * 0.62

  let left = 0
  while (left < columnMean.length - 1 && columnMean[left] < columnThreshold) left += 1
  let right = columnMean.length - 1
  while (right > left && columnMean[right] < columnThreshold) right -= 1
  let top = 0
  while (top < rowMean.length - 1 && rowMean[top] < rowThreshold) top += 1
  let bottom = rowMean.length - 1
  while (bottom > top && rowMean[bottom] < rowThreshold) bottom -= 1

  if (right - left < 4 || bottom - top < 4) return window

  return {
    x0: (x0 + left) / width,
    x1: (x0 + right + 1) / width,
    y0: (y0 + top) / height,
    y1: (y0 + bottom + 1) / height,
    strength: window.strength,
  }
}

function medianColor(samples: number[][], percentile = 0.5): string {
  if (samples.length === 0) return '#cccccc'
  // Сортируем по яркости и берём образец на нужном перцентиле целиком,
  // чтобы не смешивать каналы разных поверхностей в несуществующий оттенок.
  const sorted = [...samples].sort(
    (a, b) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2] - (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]),
  )
  const pick = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))]
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  return `#${toHex(pick[0])}${toHex(pick[1])}${toHex(pick[2])}`
}

/**
 * Цвет ровной поверхности: берём только пиксели со слабым градиентом, чтобы
 * не поймать кромки, швы и рисунок мебели.
 */
function surfaceSamples(
  buffers: Buffers,
  regions: Array<{ x0: number; y0: number; x1: number; y1: number }>,
  skip: (x: number, y: number) => boolean,
): number[][] {
  const { width, height, rgb, magnitude } = buffers
  const samples: number[][] = []

  for (const region of regions) {
    const x0 = Math.max(0, Math.floor(region.x0 * width))
    const x1 = Math.min(width, Math.ceil(region.x1 * width))
    const y0 = Math.max(0, Math.floor(region.y0 * height))
    const y1 = Math.min(height, Math.ceil(region.y1 * height))

    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = y * width + x
        if (magnitude[i] > 0.5) continue
        if (skip(x / width, y / height)) continue
        const o = i * 4
        samples.push([rgb[o], rgb[o + 1], rgb[o + 2]])
      }
    }
  }
  return samples
}

/** Протяжённость сильной горизонтальной кромки в заданной строке. */
function horizontalSpan(
  buffers: Buffers,
  row: number,
): { left: number; right: number } | null {
  const { width, height, gy } = buffers
  if (row < 2 || row >= height - 2) return null

  const strength = new Float32Array(width)
  let peak = 0
  for (let x = 0; x < width; x += 1) {
    let best = 0
    for (let dy = -2; dy <= 2; dy += 1) {
      const value = Math.abs(gy[(row + dy) * width + x])
      if (value > best) best = value
    }
    strength[x] = best
    if (best > peak) peak = best
  }
  if (peak < 0.2) return null

  const threshold = peak * 0.22
  let left = -1
  let right = -1
  for (let x = 0; x < width; x += 1) {
    if (strength[x] < threshold) continue
    if (left < 0) left = x
    right = x
  }
  if (left < 0 || right - left < width * 0.25) return null
  return { left: left / width, right: (right + 1) / width }
}

/**
 * Наклон линии столешницы: слева и справа ищем ту же самую кромку в узкой
 * полосе вокруг найденной строки. Сильный наклон означает съёмку под углом —
 * фронтальная модель кухни к такому кадру неприменима.
 */
function measureEdgeTilt(buffers: Buffers, centreRow: number, radius: number): number | null {
  const { width, height, gy } = buffers
  const from = Math.max(1, Math.round(centreRow - radius))
  const to = Math.min(height - 1, Math.round(centreRow + radius))
  if (to - from < 4) return null

  const strongestRow = (x0: number, x1: number): { row: number; strength: number } => {
    let bestRow = -1
    let best = 0
    for (let y = from; y < to; y += 1) {
      let sum = 0
      for (let x = x0; x < x1; x += 1) sum += Math.abs(gy[y * width + x])
      if (sum > best) {
        best = sum
        bestRow = y
      }
    }
    return { row: bestRow, strength: best / Math.max(1, x1 - x0) }
  }

  const third = Math.floor(width / 3)
  const left = strongestRow(0, third)
  const right = strongestRow(width - third, width)
  // Обе стороны должны видеть выраженную кромку, иначе сравнивать нечего.
  if (left.row < 0 || right.row < 0 || left.strength < 0.15 || right.strength < 0.15) return null

  const run = (width * 2) / 3
  return (Math.atan2(right.row - left.row, run) * 180) / Math.PI
}

export function analyzePhoto(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): PhotoAnalysis {
  const buffers = toBuffers(pixels, width, height)
  const rows = rowProfile(buffers)
  const columns = columnProfile(buffers)

  let frameLumaSum = 0
  for (let i = 0; i < buffers.luma.length; i += 5) frameLumaSum += buffers.luma[i]
  const frameMeanLuma = frameLumaSum / Math.ceil(buffers.luma.length / 5)

  const windows = findWindows(buffers, frameMeanLuma)
  const vanishing = findVanishingPoint(buffers)

  // Стык пола ищем в нижней трети кадра, потолка — в верхней четверти.
  const floorPeak = findPeak(rows, Math.floor(height * 0.55), height - 2)
  const ceilingPeak = findPeak(rows, 2, Math.floor(height * 0.28))
  const counterPeak = findPeak(rows, Math.floor(height * 0.3), Math.floor(height * 0.72))

  const floorLineY = floorPeak && floorPeak.strength > 0.2 ? floorPeak.index / height : null
  const ceilingLineY = ceilingPeak && ceilingPeak.strength > 0.2 ? ceilingPeak.index / height : null
  const counterLineY = counterPeak && counterPeak.strength > 0.15 ? counterPeak.index / height : null

  // Углы дальней стены — сильные вертикальные перепады слева и справа от центра.
  const leftPeak = findPeak(columns, 2, Math.floor(width * 0.34))
  const rightPeak = findPeak(columns, Math.floor(width * 0.66), width - 2)
  const wallSpan =
    leftPeak && rightPeak && leftPeak.strength > 0.25 && rightPeak.strength > 0.25
      ? { left: leftPeak.index / width, right: rightPeak.index / width }
      : null

  const counterSpan =
    counterLineY !== null ? horizontalSpan(buffers, Math.round(counterLineY * height)) : null

  // Отдаём найденное значение как есть: как им распорядиться, решает расчёт
  // камеры, у которого есть ещё и размеры помещения от пользователя.
  const horizonY = vanishing ? clamp01(vanishing.y / height) : 0.5

  // Свет: сторону задаёт окно, тон — баланс каналов в светлых участках.
  const brightest = windows[0] ?? null
  let warmSum = 0
  let coolSum = 0
  let lumaSum = 0
  let lumaSquares = 0
  let samples = 0
  for (let i = 0; i < buffers.luma.length; i += 7) {
    const o = i * 4
    lumaSum += buffers.luma[i]
    lumaSquares += buffers.luma[i] * buffers.luma[i]
    samples += 1
    if (buffers.luma[i] > 0.55) {
      warmSum += pixels[o]
      coolSum += pixels[o + 2]
    }
  }
  const meanLuma = samples > 0 ? lumaSum / samples : 0.5
  const variance = samples > 0 ? Math.max(0, lumaSquares / samples - meanLuma * meanLuma) : 0.04
  const warmth = clamp01(0.5 + ((warmSum - coolSum) / Math.max(1, warmSum + coolSum)) * 3.4)
  const directionX = brightest ? clamp01((brightest.x0 + brightest.x1) / 2) * 2 - 1 : 0

  const inWindow = (x: number, y: number) =>
    windows.some((w) => x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1)

  // Стену ищем сразу под стыком с потолком и по краям кадра — там её видно
  // почти всегда, даже когда всю середину занимает мебель.
  const ceilingEdge = ceilingLineY ?? 0.06
  const wallRegions = [
    { x0: 0.05, y0: ceilingEdge + 0.015, x1: 0.95, y1: ceilingEdge + 0.11 },
    { x0: 0, y0: ceilingEdge + 0.02, x1: 0.06, y1: 0.6 },
    { x0: 0.94, y0: ceilingEdge + 0.02, x1: 1, y1: 0.6 },
  ]
  const floorEdge = floorLineY ?? 0.9
  const colors = {
    ceiling: medianColor(
      surfaceSamples(buffers, [{ x0: 0.1, y0: 0, x1: 0.9, y1: Math.max(0.03, ceilingEdge - 0.01) }], inWindow),
    ),
    wall: medianColor(surfaceSamples(buffers, wallRegions, inWindow), 0.7),
    floor: medianColor(
      surfaceSamples(buffers, [{ x0: 0.05, y0: Math.min(0.97, floorEdge + 0.02), x1: 0.95, y1: 1 }], inWindow),
      0.6,
    ),
  }

  const kitchenBand =
    floorLineY !== null || counterLineY !== null
      ? {
          top: ceilingLineY !== null ? Math.min(0.35, ceilingLineY + 0.05) : 0.12,
          bottom: floorLineY !== null ? Math.min(1, floorLineY + 0.04) : 0.94,
        }
      : null

  const edgeTilt =
    counterLineY !== null
      ? measureEdgeTilt(buffers, counterLineY * height, height * 0.06)
      : null

  // Вписывание работает только на фронтальном кадре прямой кухни у стены.
  // Проверяем это до расчёта, а не после — кривой композит хуже отказа.
  const spanShare = counterSpan ? counterSpan.right - counterSpan.left : 0
  let composeReason: string | null = null
  if (floorLineY === null) {
    composeReason = 'на снимке не видно стык пола со стеной'
  } else if (counterLineY === null || spanShare < 0.45) {
    composeReason = 'не видно сплошную линию столешницы поперёк кадра'
  } else if (edgeTilt !== null && Math.abs(edgeTilt) > 3.5) {
    composeReason = `кухня снята под углом (наклон кромки ${Math.abs(edgeTilt).toFixed(0)}°)`
  } else if (vanishing && Math.abs(vanishing.x / width - 0.5) > 0.35) {
    composeReason = 'камера смотрит не на стену с кухней'
  }

  // Доверие складывается из найденной перспективы, стыка пола и углов стены.
  const confidence = clamp01(
    (vanishing ? vanishing.confidence * 0.5 : 0) +
      (floorPeak ? floorPeak.strength * 0.3 : 0) +
      (wallSpan ? 0.2 : 0),
  )

  return {
    width,
    height,
    horizonY,
    vanishing: vanishing ? { x: vanishing.x, y: vanishing.y } : null,
    // Телефоны снимают широко: 65° по горизонтали — разумная опора.
    fovHorizontal: (65 * Math.PI) / 180,
    floorLineY,
    ceilingLineY,
    counterLineY,
    wallSpan,
    counterSpan,
    windows,
    light: {
      directionX,
      warmth,
      brightness: clamp01(meanLuma * 1.5),
      contrast: clamp01(Math.sqrt(variance) * 3.2),
    },
    colors,
    kitchenBand,
    edgeTilt,
    suitability: { composable: composeReason === null, reason: composeReason },
    confidence,
  }
}
