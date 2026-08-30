import { shadeSurface } from './materials.ts'
import { hash1 } from './noise.ts'
import type { RenderBox, SceneSpec } from './types.ts'

/**
 * Трассировщик лучей для интерьерной сцены.
 *
 * Мягкие тени от площадных источников, затенение в углах и под мебелью,
 * отражения на глянце, камне и полу, физически осмысленное затухание света.
 * Возвращает линейный HDR-буфер: тональная компрессия — в постобработке.
 */

const EPS = 1e-4

let boxMin: Float64Array
let boxMax: Float64Array
let boxMaterial: Int32Array
let boxInverted: Uint8Array
/** Прозрачные для теней объекты — светящиеся плоскости окон и ламп. */
let boxOpaque: Uint8Array
/** Невидимые для первичных лучей части комнаты. */
let boxHidden: Uint8Array
/** Плоскости, принимающие тень от кухни. */
let boxCatcher: Uint8Array
let boxCount = 0
let boxList: RenderBox[] = []

let hitT = 0
let hitBox = -1
let hitAxis = 0
let hitSign = 1

function prepare(scene: SceneSpec): void {
  boxList = scene.boxes
  boxCount = scene.boxes.length
  boxMin = new Float64Array(boxCount * 3)
  boxMax = new Float64Array(boxCount * 3)
  boxMaterial = new Int32Array(boxCount)
  boxInverted = new Uint8Array(boxCount)
  boxOpaque = new Uint8Array(boxCount)
  boxHidden = new Uint8Array(boxCount)
  boxCatcher = new Uint8Array(boxCount)

  for (let i = 0; i < boxCount; i += 1) {
    const box = scene.boxes[i]
    boxMin[i * 3] = box.min[0]
    boxMin[i * 3 + 1] = box.min[1]
    boxMin[i * 3 + 2] = box.min[2]
    boxMax[i * 3] = box.max[0]
    boxMax[i * 3 + 1] = box.max[1]
    boxMax[i * 3 + 2] = box.max[2]
    boxMaterial[i] = box.material
    boxInverted[i] = box.inverted ? 1 : 0
    boxOpaque[i] = scene.materials[box.material].emission ? 0 : 1
    boxHidden[i] = box.hidden ? 1 : 0
    boxCatcher[i] = box.shadowCatcher ? 1 : 0
  }
}

function intersect(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tMax: number,
  skipHidden = false,
): boolean {
  hitT = tMax
  hitBox = -1

  const idx = 1 / dx
  const idy = 1 / dy
  const idz = 1 / dz

  for (let i = 0; i < boxCount; i += 1) {
    if (skipHidden && boxHidden[i] === 1) continue
    const o = i * 3
    let t1 = (boxMin[o] - ox) * idx
    let t2 = (boxMax[o] - ox) * idx
    let near = t1 < t2 ? t1 : t2
    let far = t1 < t2 ? t2 : t1
    let axisNear = 0
    let axisFar = 0

    t1 = (boxMin[o + 1] - oy) * idy
    t2 = (boxMax[o + 1] - oy) * idy
    let lo = t1 < t2 ? t1 : t2
    let hi = t1 < t2 ? t2 : t1
    if (lo > near) {
      near = lo
      axisNear = 1
    }
    if (hi < far) {
      far = hi
      axisFar = 1
    }

    t1 = (boxMin[o + 2] - oz) * idz
    t2 = (boxMax[o + 2] - oz) * idz
    lo = t1 < t2 ? t1 : t2
    hi = t1 < t2 ? t2 : t1
    if (lo > near) {
      near = lo
      axisNear = 2
    }
    if (hi < far) {
      far = hi
      axisFar = 2
    }

    if (far < near || far < EPS) continue

    if (boxInverted[i] === 1) {
      if (far < hitT) {
        hitT = far
        hitBox = i
        hitAxis = axisFar
        const dir = axisFar === 0 ? dx : axisFar === 1 ? dy : dz
        hitSign = dir > 0 ? -1 : 1
      }
      continue
    }

    const inside = near <= EPS
    const t = inside ? far : near
    if (t > EPS && t < hitT) {
      hitT = t
      hitBox = i
      hitAxis = inside ? axisFar : axisNear
      const dir = hitAxis === 0 ? dx : hitAxis === 1 ? dy : dz
      hitSign = inside ? (dir > 0 ? -1 : 1) : dir > 0 ? -1 : 1
    }
  }

  return hitBox >= 0
}

function occluded(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tMax: number,
  visibleOnly = false,
): boolean {
  const idx = 1 / dx
  const idy = 1 / dy
  const idz = 1 / dz

  for (let i = 0; i < boxCount; i += 1) {
    if (boxInverted[i] === 1 || boxOpaque[i] === 0) continue
    if (visibleOnly && boxHidden[i] === 1) continue
    const o = i * 3
    let t1 = (boxMin[o] - ox) * idx
    let t2 = (boxMax[o] - ox) * idx
    let near = t1 < t2 ? t1 : t2
    let far = t1 < t2 ? t2 : t1

    t1 = (boxMin[o + 1] - oy) * idy
    t2 = (boxMax[o + 1] - oy) * idy
    let lo = t1 < t2 ? t1 : t2
    let hi = t1 < t2 ? t2 : t1
    if (lo > near) near = lo
    if (hi < far) far = hi

    t1 = (boxMin[o + 2] - oz) * idz
    t2 = (boxMax[o + 2] - oz) * idz
    lo = t1 < t2 ? t1 : t2
    hi = t1 < t2 ? t2 : t1
    if (lo > near) near = lo
    if (hi < far) far = hi

    if (far >= near && near > EPS && near < tMax) return true
  }
  return false
}

const albedoOut = new Float64Array(3)
const shadeResult = new Float64Array(3)
/** Альбедо первичного попадания — база для демодуляции при шумоподавлении. */
const primaryAlbedo = new Float64Array(3)

interface ShadeContext {
  scene: SceneSpec
  aoSamples: number
}

function fresnel(f0: number, cosTheta: number): number {
  const m = 1 - cosTheta
  const m2 = m * m
  return f0 + (1 - f0) * m2 * m2 * m
}

function ambientOcclusion(
  ctx: ShadeContext,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  jitter: number,
  visibleOnly = false,
): number {
  const samples = ctx.aoSamples
  if (samples === 0) return 1

  let ux: number
  let uy: number
  let uz: number
  if (Math.abs(nx) < 0.7) {
    ux = 0
    uy = -nz
    uz = ny
  } else {
    ux = -nz
    uy = 0
    uz = nx
  }
  const ulen = Math.hypot(ux, uy, uz) || 1
  ux /= ulen
  uy /= ulen
  uz /= ulen
  const vx = ny * uz - nz * uy
  const vy = nz * ux - nx * uz
  const vz = nx * uy - ny * ux

  const radius = 0.66
  let open = 0
  for (let s = 0; s < samples; s += 1) {
    const r1 = hash1(jitter + s * 7.31)
    const r2 = hash1(jitter + s * 13.77 + 4.1)
    const r = Math.sqrt(r1)
    const theta = 2 * Math.PI * r2
    const a = r * Math.cos(theta)
    const b = r * Math.sin(theta)
    const c = Math.sqrt(Math.max(0, 1 - r1))
    const dx = ux * a + vx * b + nx * c
    const dy = uy * a + vy * b + ny * c
    const dz = uz * a + vz * b + nz * c
    if (
      !occluded(px + nx * 0.002, py + ny * 0.002, pz + nz * 0.002, dx, dy, dz, radius, visibleOnly)
    ) {
      open += 1
    }
  }
  return 0.2 + 0.8 * (open / samples)
}

function shade(
  ctx: ShadeContext,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  dx: number,
  dy: number,
  dz: number,
  boxIndex: number,
  axis: number,
  jitter: number,
  depth: number,
): void {
  const scene = ctx.scene
  const box = boxList[boxIndex]
  const material = scene.materials[boxMaterial[boxIndex]]

  if (material.emission) {
    shadeResult[0] = material.emission[0]
    shadeResult[1] = material.emission[1]
    shadeResult[2] = material.emission[2]
    return
  }

  const roughness = shadeSurface(material, box, px, py, pz, axis, scene.seed, albedoOut)
  const ar = albedoOut[0]
  const ag = albedoOut[1]
  const ab = albedoOut[2]
  if (depth === 0) {
    primaryAlbedo[0] = ar
    primaryAlbedo[1] = ag
    primaryAlbedo[2] = ab
  }

  const metallic = material.metallic
  const f0 = 0.04 + (0.92 - 0.04) * metallic
  const alpha = Math.max(0.02, roughness * roughness)
  const shininess = Math.min(4096, 2 / (alpha * alpha) - 2)
  const specNorm = (shininess + 8) / 25.13

  let dr = 0
  let dg = 0
  let db = 0
  let sr = 0
  let sg = 0
  let sb = 0

  const lights = scene.lights
  for (let l = 0; l < lights.length; l += 1) {
    const light = lights[l]
    const samples = depth > 0 ? 1 : light.samples
    const area = Math.hypot(
      light.u[1] * light.v[2] - light.u[2] * light.v[1],
      light.u[2] * light.v[0] - light.u[0] * light.v[2],
      light.u[0] * light.v[1] - light.u[1] * light.v[0],
    )

    for (let s = 0; s < samples; s += 1) {
      const a = hash1(jitter + l * 31.7 + s * 5.13)
      const b = hash1(jitter + l * 17.3 + s * 9.71 + 2.3)
      const lx = light.origin[0] + light.u[0] * a + light.v[0] * b
      const ly = light.origin[1] + light.u[1] * a + light.v[1] * b
      const lz = light.origin[2] + light.u[2] * a + light.v[2] * b

      let wx = lx - px
      let wy = ly - py
      let wz = lz - pz
      const dist2 = wx * wx + wy * wy + wz * wz
      const dist = Math.sqrt(dist2)
      wx /= dist
      wy /= dist
      wz /= dist

      const ndotl = nx * wx + ny * wy + nz * wz
      if (ndotl <= 0) continue
      const lcos = -(light.normal[0] * wx + light.normal[1] * wy + light.normal[2] * wz)
      if (lcos <= 0) continue

      if (occluded(px + nx * 0.0015, py + ny * 0.0015, pz + nz * 0.0015, wx, wy, wz, dist - 0.006))
        continue

      // Ограничение: большая близкая плоскость иначе даёт всплески яркости.
      const geom = Math.min(
        7,
        (light.intensity * area * ndotl * lcos) / (dist2 * samples * Math.PI),
      )
      dr += light.color[0] * geom
      dg += light.color[1] * geom
      db += light.color[2] * geom

      let hx = wx - dx
      let hy = wy - dy
      let hz = wz - dz
      const hlen = Math.hypot(hx, hy, hz) || 1
      hx /= hlen
      hy /= hlen
      hz /= hlen
      const ndoth = Math.max(0, nx * hx + ny * hy + nz * hz)
      // Ограничение блика: без него на тёмном глянце появляются «светлячки».
      const specular = Math.min(
        26,
        specNorm * Math.pow(ndoth, shininess) * fresnel(f0, Math.max(0, ndotl)),
      )
      sr += light.color[0] * geom * specular
      sg += light.color[1] * geom * specular
      sb += light.color[2] * geom * specular
    }
  }

  const ao = depth > 0 ? 0.85 : ambientOcclusion(ctx, px, py, pz, nx, ny, nz, jitter)
  const ambient = scene.ambient
  const specWeight = 0.4 + 0.6 * metallic

  let cr = ar * (dr + ambient[0] * ao) + sr * specWeight
  let cg = ag * (dg + ambient[1] * ao) + sg * specWeight
  let cb = ab * (db + ambient[2] * ao) + sb * specWeight

  // Отражение — то, что отличает камень и глянец от бумаги.
  if (depth === 0 && roughness < 0.42) {
    const dn = dx * nx + dy * ny + dz * nz
    const rx = dx - 2 * dn * nx
    const ry = dy - 2 * dn * ny
    const rz = dz - 2 * dn * nz

    const ox = px + nx * 0.002
    const oy = py + ny * 0.002
    const oz = pz + nz * 0.002

    let rr = ambient[0]
    let rg = ambient[1]
    let rb = ambient[2]
    if (intersect(ox, oy, oz, rx, ry, rz, 40)) {
      const rBox = hitBox
      const rAxis = hitAxis
      const rSign = hitSign
      const rt = hitT
      const hx = ox + rx * rt
      const hy = oy + ry * rt
      const hz = oz + rz * rt
      let rnx = 0
      let rny = 0
      let rnz = 0
      if (rAxis === 0) rnx = rSign
      else if (rAxis === 1) rny = rSign
      else rnz = rSign
      shade(ctx, hx, hy, hz, rnx, rny, rnz, rx, ry, rz, rBox, rAxis, jitter + 3.7, depth + 1)
      // Ограничение яркости отражения: иначе зеркальный блик окна на тёмном
      // фасаде рассыпается в отдельные пересвеченные точки.
      rr = Math.min(4.5, shadeResult[0])
      rg = Math.min(4.5, shadeResult[1])
      rb = Math.min(4.5, shadeResult[2])
    }

    const k = Math.min(
      0.8,
      fresnel(f0, Math.max(0.02, Math.abs(dn))) * (1 - roughness / 0.42) * (0.6 + 0.4 * metallic),
    )
    const tintR = metallic > 0.5 ? ar : 0.55 + 0.45 * ar
    const tintG = metallic > 0.5 ? ag : 0.55 + 0.45 * ag
    const tintB = metallic > 0.5 ? ab : 0.55 + 0.45 * ab
    cr = cr * (1 - k) + rr * k * tintR
    cg = cg * (1 - k) + rg * k * tintG
    cb = cb * (1 - k) + rb * k * tintB
  }

  shadeResult[0] = cr
  shadeResult[1] = cg
  shadeResult[2] = cb
}

const KERNEL = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16]

/**
 * Шумоподавление в стиле à-trous с демодуляцией по альбедо.
 *
 * Фильтруется только освещённость: рисунок дерева, камня и швы фасадов
 * возвращаются на место умножением обратно, поэтому детали не мылятся.
 */
function denoise(
  color: Float32Array,
  albedo: Float32Array,
  ids: Int32Array,
  width: number,
  height: number,
): void {
  const pixels = width * height
  const light = new Float32Array(pixels * 3)
  const temp = new Float32Array(pixels * 3)

  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3
    light[o] = color[o] / Math.max(0.02, albedo[o])
    light[o + 1] = color[o + 1] / Math.max(0.02, albedo[o + 1])
    light[o + 2] = color[o + 2] / Math.max(0.02, albedo[o + 2])
  }

  // Гашение «светлячков» — одиночных пересвеченных пикселей от бликов.
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const o = index * 3
      const id = ids[index]
      const own = 0.2126 * light[o] + 0.7152 * light[o + 1] + 0.0722 * light[o + 2]
      if (own < 0.12) continue

      let maxNeighbour = 0
      let count = 0
      for (const offset of [-1, 1, -width, width]) {
        const n = index + offset
        if (ids[n] !== id) continue
        const no = n * 3
        const luminance = 0.2126 * light[no] + 0.7152 * light[no + 1] + 0.0722 * light[no + 2]
        if (luminance > maxNeighbour) maxNeighbour = luminance
        count += 1
      }
      if (count < 2 || own <= maxNeighbour * 1.7) continue

      const scale = (maxNeighbour * 1.7) / own
      light[o] *= scale
      light[o + 1] *= scale
      light[o + 2] *= scale
    }
  }

  let source = light
  let target = temp

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const step = 1 << iteration
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        const o = index * 3
        const id = ids[index]
        const centre =
          0.2126 * source[o] + 0.7152 * source[o + 1] + 0.0722 * source[o + 2]

        let sr = 0
        let sg = 0
        let sb = 0
        let weightSum = 0

        for (let ky = -2; ky <= 2; ky += 1) {
          const sy = y + ky * step
          if (sy < 0 || sy >= height) continue
          for (let kx = -2; kx <= 2; kx += 1) {
            const sx = x + kx * step
            if (sx < 0 || sx >= width) continue
            const sIndex = sy * width + sx
            if (ids[sIndex] !== id) continue

            const so = sIndex * 3
            const luminance =
              0.2126 * source[so] + 0.7152 * source[so + 1] + 0.0722 * source[so + 2]
            const diff = luminance - centre
            // Порог различия масштабируется от локальной яркости: после
            // демодуляции на тёмных поверхностях значения на порядок больше.
            const scale = 0.5 + centre * centre * 0.6
            const weight =
              KERNEL[ky + 2] * KERNEL[kx + 2] * Math.exp(-(diff * diff) / scale)

            sr += source[so] * weight
            sg += source[so + 1] * weight
            sb += source[so + 2] * weight
            weightSum += weight
          }
        }

        if (weightSum > 0) {
          target[o] = sr / weightSum
          target[o + 1] = sg / weightSum
          target[o + 2] = sb / weightSum
        } else {
          target[o] = source[o]
          target[o + 1] = source[o + 1]
          target[o + 2] = source[o + 2]
        }
      }
    }

    const swap = source
    source = target
    target = swap
  }

  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3
    color[o] = source[o] * Math.max(0.02, albedo[o])
    color[o + 1] = source[o + 1] * Math.max(0.02, albedo[o + 1])
    color[o + 2] = source[o + 2] * Math.max(0.02, albedo[o + 2])
  }
}

/**
 * Доля перекрытого света в точке пола: так кухня отбрасывает тень
 * на настоящий пол с фотографии.
 */
function shadowCatcherAlpha(
  ctx: ShadeContext,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  jitter: number,
): number {
  const lights = ctx.scene.lights
  let lit = 0
  let total = 0

  for (let l = 0; l < lights.length; l += 1) {
    const light = lights[l]
    const samples = light.samples
    const area = Math.hypot(
      light.u[1] * light.v[2] - light.u[2] * light.v[1],
      light.u[2] * light.v[0] - light.u[0] * light.v[2],
      light.u[0] * light.v[1] - light.u[1] * light.v[0],
    )

    for (let s = 0; s < samples; s += 1) {
      const a = hash1(jitter + l * 31.7 + s * 5.13)
      const b = hash1(jitter + l * 17.3 + s * 9.71 + 2.3)
      const lx = light.origin[0] + light.u[0] * a + light.v[0] * b
      const ly = light.origin[1] + light.u[1] * a + light.v[1] * b
      const lz = light.origin[2] + light.u[2] * a + light.v[2] * b

      let wx = lx - px
      let wy = ly - py
      let wz = lz - pz
      const dist2 = wx * wx + wy * wy + wz * wz
      const dist = Math.sqrt(dist2)
      wx /= dist
      wy /= dist
      wz /= dist

      const ndotl = nx * wx + ny * wy + nz * wz
      if (ndotl <= 0) continue
      const lcos = -(light.normal[0] * wx + light.normal[1] * wy + light.normal[2] * wz)
      if (lcos <= 0) continue

      const geom = Math.min(7, (light.intensity * area * ndotl * lcos) / (dist2 * samples * Math.PI))
      total += geom
      if (
        !occluded(px + nx * 0.0015, py + ny * 0.0015, pz + nz * 0.0015, wx, wy, wz, dist - 0.006, true)
      ) {
        lit += geom
      }
    }
  }

  const blocked = total > 0 ? 1 - lit / total : 0
  // Контактное затенение под мебелью — короткие лучи только по кухне.
  const contact = 1 - ambientOcclusion(ctx, px, py, pz, nx, ny, nz, jitter + 11.3, true)
  return Math.min(0.86, blocked * 0.72 + contact * 0.45)
}

export interface RenderOptions {
  width: number
  height: number
  aoSamples?: number
  onProgress?: (ratio: number) => void
}

export interface RenderResult {
  /** Линейный HDR-цвет. */
  color: Float32Array
  /** Покрытие кадра кухней и её тенью, 0..1. */
  alpha: Float32Array
}

export function renderScene(scene: SceneSpec, options: RenderOptions): RenderResult {
  const { width, height, aoSamples = 4, onProgress } = options
  prepare(scene)

  const ctx: ShadeContext = { scene, aoSamples }
  const buffer = new Float32Array(width * height * 3)
  const albedoBuffer = new Float32Array(width * height * 3)
  const alphaBuffer = new Float32Array(width * height)
  const hitIds = new Int32Array(width * height)
  const compositing = scene.compositing === true

  const camera = scene.camera
  const ox = camera.position[0]
  const oy = camera.position[1]
  const oz = camera.position[2]

  let fx = camera.target[0] - ox
  let fy = camera.target[1] - oy
  let fz = camera.target[2] - oz
  const flen = Math.hypot(fx, fy, fz)
  fx /= flen
  fy /= flen
  fz /= flen

  // right = cross(worldUp, forward), up = cross(forward, right)
  let rx = fz
  let ry = 0
  let rz = -fx
  const rlen = Math.hypot(rx, ry, rz) || 1
  rx /= rlen
  ry /= rlen
  rz /= rlen

  const ux = fy * rz - fz * ry
  const uy = fz * rx - fx * rz
  const uz = fx * ry - fy * rx

  const halfH = Math.tan(((camera.fov * Math.PI) / 180) * 0.5)
  const halfW = (halfH * width) / height

  const sample = new Float64Array(3)
  let sampleAlpha = 0

  const trace = (sx: number, sy: number, jitter: number): number => {
    const px = (2 * (sx / width) - 1) * halfW
    const py = (1 - 2 * (sy / height)) * halfH
    let dx = fx + rx * px + ux * py
    let dy = fy + ry * px + uy * py
    let dz = fz + rz * px + uz * py
    const dlen = Math.hypot(dx, dy, dz)
    dx /= dlen
    dy /= dlen
    dz /= dlen

    if (!intersect(ox, oy, oz, dx, dy, dz, 200, compositing)) {
      sample[0] = scene.ambient[0]
      sample[1] = scene.ambient[1]
      sample[2] = scene.ambient[2]
      primaryAlbedo[0] = 1
      primaryAlbedo[1] = 1
      primaryAlbedo[2] = 1
      sampleAlpha = 0

      if (compositing) {
        // Луч прошёл мимо кухни: возможно, он попал в пол — там рисуем тень.
        if (intersect(ox, oy, oz, dx, dy, dz, 200) && boxCatcher[hitBox] === 1) {
          const axis = hitAxis
          const sign = hitSign
          const t = hitT
          const hx = ox + dx * t
          const hy = oy + dy * t
          const hz = oz + dz * t
          let nx = 0
          let ny = 0
          let nz = 0
          if (axis === 0) nx = sign
          else if (axis === 1) ny = sign
          else nz = sign
          sampleAlpha = shadowCatcherAlpha(ctx, hx, hy, hz, nx, ny, nz, jitter)
          sample[0] = 0
          sample[1] = 0
          sample[2] = 0
          primaryAlbedo[0] = 1
          primaryAlbedo[1] = 1
          primaryAlbedo[2] = 1
          return -2
        }
      }
      return -1
    }
    sampleAlpha = 1

    const boxIndex = hitBox
    const axis = hitAxis
    const sign = hitSign
    const t = hitT
    const hx = ox + dx * t
    const hy = oy + dy * t
    const hz = oz + dz * t
    let nx = 0
    let ny = 0
    let nz = 0
    if (axis === 0) nx = sign
    else if (axis === 1) ny = sign
    else nz = sign

    shade(ctx, hx, hy, hz, nx, ny, nz, dx, dy, dz, boxIndex, axis, jitter, 0)
    sample[0] = shadeResult[0]
    sample[1] = shadeResult[1]
    sample[2] = shadeResult[2]
    return boxIndex
  }

  const progressStep = Math.max(1, Math.floor(height / 20))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      hitIds[index] = trace(x + 0.5, y + 0.5, index * 0.618)
      buffer[index * 3] = sample[0]
      buffer[index * 3 + 1] = sample[1]
      buffer[index * 3 + 2] = sample[2]
      alphaBuffer[index] = sampleAlpha
      albedoBuffer[index * 3] = primaryAlbedo[0]
      albedoBuffer[index * 3 + 1] = primaryAlbedo[1]
      albedoBuffer[index * 3 + 2] = primaryAlbedo[2]
    }
    if (onProgress && y % progressStep === 0) onProgress((y / height) * 0.88)
  }

  // Сглаживание: дополнительные лучи только на границах объектов.
  const offsets = [0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75]
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const id = hitIds[index]
      if (
        id === hitIds[index - 1] &&
        id === hitIds[index + 1] &&
        id === hitIds[index - width] &&
        id === hitIds[index + width]
      ) {
        continue
      }

      let ar = buffer[index * 3]
      let ag = buffer[index * 3 + 1]
      let ab = buffer[index * 3 + 2]
      let aa = alphaBuffer[index]
      for (let s = 0; s < 4; s += 1) {
        trace(x + offsets[s * 2], y + offsets[s * 2 + 1], index * 0.618 + s * 2.7)
        ar += sample[0]
        ag += sample[1]
        ab += sample[2]
        aa += sampleAlpha
      }
      buffer[index * 3] = ar / 5
      buffer[index * 3 + 1] = ag / 5
      buffer[index * 3 + 2] = ab / 5
      alphaBuffer[index] = aa / 5
    }
    if (onProgress && y % progressStep === 0) onProgress(0.88 + (y / height) * 0.12)
  }

  denoise(buffer, albedoBuffer, hitIds, width, height)

  onProgress?.(1)
  return { color: buffer, alpha: alphaBuffer }
}
