/** Быстрый детерминированный шум для процедурных материалов. */

export function hash1(n: number): number {
  const s = Math.sin(n) * 43758.5453123
  return s - Math.floor(s)
}

export function hash3(x: number, y: number, z: number): number {
  return hash1(x * 127.1 + y * 311.7 + z * 74.7)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Трилинейный value-noise. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const fz = smooth(z - iz)

  const c000 = hash3(ix, iy, iz)
  const c100 = hash3(ix + 1, iy, iz)
  const c010 = hash3(ix, iy + 1, iz)
  const c110 = hash3(ix + 1, iy + 1, iz)
  const c001 = hash3(ix, iy, iz + 1)
  const c101 = hash3(ix + 1, iy, iz + 1)
  const c011 = hash3(ix, iy + 1, iz + 1)
  const c111 = hash3(ix + 1, iy + 1, iz + 1)

  const x00 = c000 + (c100 - c000) * fx
  const x10 = c010 + (c110 - c010) * fx
  const x01 = c001 + (c101 - c001) * fx
  const x11 = c011 + (c111 - c011) * fx
  const y0 = x00 + (x10 - x00) * fy
  const y1 = x01 + (x11 - x01) * fy
  return y0 + (y1 - y0) * fz
}

/** Фрактальный шум — база для древесного волокна и прожилок камня. */
export function fbm(x: number, y: number, z: number, octaves = 4): number {
  let value = 0
  let amplitude = 0.5
  let fx = x
  let fy = y
  let fz = z
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * noise3(fx, fy, fz)
    fx *= 2.03
    fy *= 2.01
    fz *= 1.97
    amplitude *= 0.5
  }
  return value
}
