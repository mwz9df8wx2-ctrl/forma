export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value))

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (v: number) => Math.round(clamp(v)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Смешивает два цвета: amount = 0 → первый, 1 → второй. */
export function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  })
}

export const lighten = (hex: string, amount: number) => mix(hex, '#ffffff', amount)
export const darken = (hex: string, amount: number) => mix(hex, '#000000', amount)

/** Подмешивает тёплый или холодный оттенок освещения. */
export function tint(hex: string, warmth: number, amount: number): string {
  const warm = '#ffcf9b'
  const cool = '#cfe0ff'
  return mix(hex, warmth >= 0.5 ? warm : cool, amount * Math.abs(warmth - 0.5) * 2)
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Относительная яркость по WCAG. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Читаемый цвет текста поверх образца. */
export function readableInk(hex: string): string {
  return luminance(hex) > 0.55 ? '#1a1917' : '#ffffff'
}

/** Ближайший по цвету элемент каталога — используется при выборе палитры. */
export function nearestByHex<T extends { hex: string }>(items: T[], hex: string): T | undefined {
  const target = hexToRgb(hex)
  let best: T | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const item of items) {
    const rgb = hexToRgb(item.hex)
    const distance =
      (rgb.r - target.r) ** 2 + (rgb.g - target.g) ** 2 + (rgb.b - target.b) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = item
    }
  }
  return best
}
