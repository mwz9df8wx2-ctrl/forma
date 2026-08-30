import { hash1 } from './noise.ts'

/**
 * Постобработка кадра: свечение бликов, тональная компрессия, виньетка,
 * лёгкая хроматическая аберрация и зерно. Именно эти шаги превращают
 * «правильный рендер» в изображение, похожее на фотографию.
 */

export interface PostOptions {
  exposure: number
  /** Сила светотеневого рисунка, 0..1. */
  contrast: number
  grain: number
  seed: number
  /** Покрытие кадра кухней: пишется в альфа-канал результата. */
  alpha?: Float32Array
  /**
   * Вписывание в фотографию: виньетку, аберрацию и зерно даёт сам снимок,
   * повторять их поверх нельзя — получится двойная обработка.
   */
  compositing?: boolean
}

function acesToneMap(x: number): number {
  const a = 2.51
  const b = 0.03
  const c = 2.43
  const d = 0.59
  const e = 0.14
  return Math.min(1, Math.max(0, (x * (a * x + b)) / (x * (c * x + d) + e)))
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

/** Свечение вокруг ярких участков — окна, бликов, светильников. */
function bloom(hdr: Float32Array, width: number, height: number): Float32Array {
  const bw = Math.max(1, width >> 2)
  const bh = Math.max(1, height >> 2)
  const bright = new Float32Array(bw * bh * 3)

  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const px = Math.min(width - 1, x * 4 + sx)
          const py = Math.min(height - 1, y * 4 + sy)
          const i = (py * width + px) * 3
          r += hdr[i]
          g += hdr[i + 1]
          b += hdr[i + 2]
        }
      }
      r /= 16
      g /= 16
      b /= 16
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const excess = Math.max(0, luminance - 1.25)
      const scale = luminance > 0 ? excess / luminance : 0
      const o = (y * bw + x) * 3
      bright[o] = r * scale
      bright[o + 1] = g * scale
      bright[o + 2] = b * scale
    }
  }

  // Два прохода разделимого размытия.
  const temp = new Float32Array(bright.length)
  const radius = 4
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let k = -radius; k <= radius; k += 1) {
          const sx = Math.min(bw - 1, Math.max(0, x + k))
          const i = (y * bw + sx) * 3
          r += bright[i]
          g += bright[i + 1]
          b += bright[i + 2]
          count += 1
        }
        const o = (y * bw + x) * 3
        temp[o] = r / count
        temp[o + 1] = g / count
        temp[o + 2] = b / count
      }
    }
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let k = -radius; k <= radius; k += 1) {
          const sy = Math.min(bh - 1, Math.max(0, y + k))
          const i = (sy * bw + x) * 3
          r += temp[i]
          g += temp[i + 1]
          b += temp[i + 2]
          count += 1
        }
        const o = (y * bw + x) * 3
        bright[o] = r / count
        bright[o + 1] = g / count
        bright[o + 2] = b / count
      }
    }
  }

  return bright
}

/** HDR-буфер → готовое изображение RGBA. */
export function developImage(
  hdr: Float32Array,
  width: number,
  height: number,
  options: PostOptions,
): Uint8ClampedArray {
  const { exposure, contrast, grain, seed, alpha, compositing } = options
  const bw = Math.max(1, width >> 2)
  const bh = Math.max(1, height >> 2)
  const glow = bloom(hdr, width, height)

  const ldr = new Float32Array(width * height * 3)

  for (let y = 0; y < height; y += 1) {
    const gy = Math.min(bh - 1, y >> 2)
    for (let x = 0; x < width; x += 1) {
      const gx = Math.min(bw - 1, x >> 2)
      const gi = (gy * bw + gx) * 3
      const i = (y * width + x) * 3

      let r = hdr[i] * exposure + glow[gi] * 0.42
      let g = hdr[i + 1] * exposure + glow[gi + 1] * 0.42
      let b = hdr[i + 2] * exposure + glow[gi + 2] * 0.42

      r = acesToneMap(r)
      g = acesToneMap(g)
      b = acesToneMap(b)

      // Мягкая плёночная кривая: чуть глубже тени, мягче света.
      const curve = 0.08 + contrast * 0.16
      r = r + curve * r * (r - 1) * (r - 0.5) * -4
      g = g + curve * g * (g - 1) * (g - 0.5) * -4
      b = b + curve * b * (b - 1) * (b - 0.5) * -4

      ldr[i] = Math.min(1, Math.max(0, r))
      ldr[i + 1] = Math.min(1, Math.max(0, g))
      ldr[i + 2] = Math.min(1, Math.max(0, b))
    }
  }

  const out = new Uint8ClampedArray(width * height * 4)
  const cx = width * 0.5
  const cy = height * 0.5
  const maxRadius = Math.hypot(cx, cy)
  const aberration = 0.5

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      const o = (y * width + x) * 4

      const dx = (x - cx) / maxRadius
      const dy = (y - cy) / maxRadius
      const radius = Math.hypot(dx, dy)

      // Хроматическая аберрация усиливается к краям кадра.
      const shift = compositing ? 0 : aberration * radius * radius
      const rx = Math.min(width - 1, Math.max(0, Math.round(x + dx * shift)))
      const ry = Math.min(height - 1, Math.max(0, Math.round(y + dy * shift)))
      const bx = Math.min(width - 1, Math.max(0, Math.round(x - dx * shift)))
      const by = Math.min(height - 1, Math.max(0, Math.round(y - dy * shift)))

      let r = ldr[(ry * width + rx) * 3]
      let g = ldr[i + 1]
      let b = ldr[(by * width + bx) * 3 + 2]

      // Виньетка.
      if (!compositing) {
        const vignette = 1 - (0.14 + contrast * 0.18) * Math.pow(radius, 2.1)
        r *= vignette
        g *= vignette
        b *= vignette
      }

      // Гамма-кодирование, и только потом зерно — иначе шум взрывается в тенях.
      r = linearToSrgb(Math.min(1, Math.max(0, r)))
      g = linearToSrgb(Math.min(1, Math.max(0, g)))
      b = linearToSrgb(Math.min(1, Math.max(0, b)))

      if (grain > 0) {
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const amount = grain * 0.022 * (1.1 - luminance * 0.75)
        const n = hash1(x * 12.9898 + y * 78.233 + seed) - 0.5
        r += n * amount
        g += n * amount * 0.94
        b += n * amount * 1.06
      }

      out[o] = Math.min(1, Math.max(0, r)) * 255
      out[o + 1] = Math.min(1, Math.max(0, g)) * 255
      out[o + 2] = Math.min(1, Math.max(0, b)) * 255
      out[o + 3] = alpha ? Math.min(1, Math.max(0, alpha[y * width + x])) * 255 : 255
    }
  }

  return out
}
