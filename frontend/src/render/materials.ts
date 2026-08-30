import { fbm, hash1, noise3 } from './noise.ts'
import type { RenderBox, RenderMaterial } from './types.ts'

const fract = (v: number) => v - Math.floor(v)

/**
 * Процедурная поверхность в точке попадания луча.
 * Возвращает шероховатость, цвет пишется в out.
 *
 * Именно этот слой отвечает за «настоящесть»: волокно дерева, прожилки камня,
 * швы между дверцами, ручки, плитка фартука и половая доска.
 */
export function shadeSurface(
  material: RenderMaterial,
  box: RenderBox,
  px: number,
  py: number,
  pz: number,
  axis: number,
  seed: number,
  out: Float64Array,
): number {
  let r = material.albedo[0]
  let g = material.albedo[1]
  let b = material.albedo[2]
  let roughness = material.roughness
  const scale = material.scale

  // Локальные координаты грани: u — поперёк, v — вдоль вертикали.
  let u: number
  let v: number
  if (axis === 1) {
    u = px - box.min[0]
    v = pz - box.min[2]
  } else if (axis === 0) {
    u = pz - box.min[2]
    v = py - box.min[1]
  } else {
    u = px - box.min[0]
    v = py - box.min[1]
  }

  switch (material.pattern) {
    case 'wood':
    case 'veneer': {
      // Волокно вдоль вертикали фасада, годичные кольца поперёк.
      const warp = fbm(u * 3.1 * scale, v * 0.7 * scale, seed, 3)
      const rings = fract(u * 5.5 * scale + warp * 2.6)
      const fibre = noise3(u * 220 * scale, v * 7 * scale, seed + 4.2)
      const ringTone = 0.82 + 0.26 * Math.pow(Math.abs(rings - 0.5) * 2, 1.4)
      const tone = ringTone * (0.94 + 0.12 * fibre)
      r *= tone
      g *= tone * 0.995
      b *= tone * 0.97
      roughness *= 0.92 + 0.16 * fibre
      break
    }
    case 'floor': {
      // Половая доска: швы, разнотон досок, продольное волокно.
      const plank = Math.floor(v / 0.185)
      const row = Math.floor(u / 1.15 + plank * 0.37)
      const seamV = Math.abs(fract(v / 0.185) - 0.5) > 0.482
      const seamU = Math.abs(fract(u / 1.15 + plank * 0.37) - 0.5) > 0.497
      const variation = 0.86 + 0.28 * hash1(plank * 13.7 + row * 7.3 + seed)
      const warp = fbm(u * 2.4, v * 8, seed + 1.7, 3)
      const rings = fract(u * 2.2 + warp * 3.1)
      const tone = variation * (0.88 + 0.2 * Math.pow(Math.abs(rings - 0.5) * 2, 1.3))
      const seam = seamV || seamU ? 0.55 : 1
      r *= tone * seam
      g *= tone * seam * 0.99
      b *= tone * seam * 0.96
      roughness *= 0.9 + 0.2 * hash1(plank * 3.1 + seed)
      break
    }
    case 'marble': {
      const turbulence = Math.abs(fbm(u * 2.2 * scale, v * 2.2 * scale, seed, 5) - 0.5) * 2
      const vein = Math.pow(1 - Math.min(1, turbulence * 2.6), 6)
      const grey = 0.42
      r += (grey - r) * vein * 0.85
      g += (grey - g) * vein * 0.85
      b += (grey - b) * vein * 0.8
      const dust = noise3(u * 60, v * 60, seed + 9)
      r *= 0.97 + 0.06 * dust
      g *= 0.97 + 0.06 * dust
      b *= 0.97 + 0.06 * dust
      break
    }
    case 'speck': {
      const grain = noise3(u * 340, v * 340, seed + 3)
      const cluster = noise3(u * 40, v * 40, seed + 8)
      const tone = 0.93 + 0.1 * grain + 0.05 * cluster
      r *= tone
      g *= tone
      b *= tone
      break
    }
    case 'stone': {
      const blotch = fbm(u * 3.4 * scale, v * 3.4 * scale, seed, 4)
      const tone = 0.88 + 0.24 * blotch
      r *= tone
      g *= tone
      b *= tone * 0.99
      break
    }
    case 'linear': {
      const line = 0.94 + 0.1 * Math.sin(v * 420 * scale)
      const grain = noise3(u * 120, v * 120, seed + 2)
      r *= line * (0.97 + 0.05 * grain)
      g *= line * (0.97 + 0.05 * grain)
      b *= line * (0.97 + 0.05 * grain)
      break
    }
    case 'tile': {
      const tileU = 0.3
      const tileV = 0.1
      const grout =
        Math.abs(fract(u / tileU) - 0.5) > 0.478 || Math.abs(fract(v / tileV) - 0.5) > 0.44
      const cell = hash1(Math.floor(u / tileU) * 5.3 + Math.floor(v / tileV) * 11.1 + seed)
      const tone = grout ? 0.72 : 0.95 + 0.1 * cell
      r *= tone
      g *= tone
      b *= tone
      roughness = grout ? 0.7 : roughness
      break
    }
    case 'wall': {
      const shade = fbm(u * 0.7, v * 0.7, seed + 5, 3)
      const tone = 0.965 + 0.06 * shade
      r *= tone
      g *= tone
      b *= tone
      break
    }
    case 'gloss':
    case 'paint': {
      const shade = noise3(u * 90, v * 90, seed + 6)
      const tone = 0.985 + 0.03 * shade
      r *= tone
      g *= tone
      b *= tone
      break
    }
    default:
      break
  }

  // Раскладка фасадов: швы, филёнка, ручки.
  const panel = material.panel
  if (panel && axis !== 1) {
    const height = box.max[1] - box.min[1]
    const width = axis === 0 ? box.max[2] - box.min[2] : box.max[0] - box.min[0]
    const doors = Math.max(1, Math.round(width / panel.doorWidth))
    const step = width / doors
    const local = fract(u / step) * step
    const edgeDistance = Math.min(local, step - local)
    const half = panel.gap * 0.5

    if (edgeDistance < half || u < half || width - u < half) {
      // Тень в шве.
      r *= 0.28
      g *= 0.28
      b *= 0.28
      roughness = 0.85
    } else if (edgeDistance < half + 0.004) {
      // Блик на скруглённой кромке.
      r = Math.min(1, r * 1.16)
      g = Math.min(1, g * 1.16)
      b = Math.min(1, b * 1.16)
    }

    if (panel.frame) {
      const inset = 0.055
      const insideX = local > inset && step - local > inset
      const insideY = v > inset && height - v > inset
      const borderX = Math.abs(local - inset) < 0.006 || Math.abs(step - local - inset) < 0.006
      const borderY = Math.abs(v - inset) < 0.006 || Math.abs(height - v - inset) < 0.006
      if ((borderX && insideY) || (borderY && insideX)) {
        r *= 0.74
        g *= 0.74
        b *= 0.74
      }
    }

    if (panel.handle === 'bar') {
      const handleY = panel.upper ? 0.05 : height - 0.06
      const margin = step * 0.22
      if (Math.abs(v - handleY) < 0.009 && local > margin && step - local > margin) {
        r = 0.42
        g = 0.42
        b = 0.44
        roughness = 0.22
      }
    } else if (panel.handle === 'knob') {
      const handleY = panel.upper ? 0.07 : height - 0.08
      const dx = local - step * 0.5
      const dy = v - handleY
      if (dx * dx + dy * dy < 0.00035) {
        r = 0.46
        g = 0.45
        b = 0.44
        roughness = 0.2
      }
    } else if (panel.handle === 'hidden') {
      const grooveY = panel.upper ? 0.016 : height - 0.016
      if (Math.abs(v - grooveY) < 0.014) {
        r *= 0.4
        g *= 0.4
        b *= 0.4
        roughness = 0.8
      }
    }
  }

  out[0] = r
  out[1] = g
  out[2] = b
  return Math.min(1, Math.max(0.03, roughness))
}
