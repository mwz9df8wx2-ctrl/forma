/** Примитивы для чертежей: тонкие линии, размерные цепочки, подписи. */

export const INK = '#1a1917'
export const THIN = '#8a857c'
export const FILL = '#f2f0ec'
export const ACCENT = '#a2542c'

export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: string; stroke?: string; strokeWidth?: number; dash?: string } = {},
): string {
  const { fill = 'none', stroke = INK, strokeWidth = 1.2, dash } = options
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, width).toFixed(1)}" height="${Math.max(0, height).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: { stroke?: string; strokeWidth?: number; dash?: string } = {},
): string {
  const { stroke = INK, strokeWidth = 1, dash } = options
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

export function text(
  x: number,
  y: number,
  value: string,
  options: { size?: number; anchor?: 'start' | 'middle' | 'end'; fill?: string; weight?: number; rotate?: number } = {},
): string {
  const { size = 11, anchor = 'middle', fill = INK, weight = 400, rotate } = options
  const transform = rotate ? ` transform="rotate(${rotate} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-family="Inter, system-ui, sans-serif" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${transform}>${escapeText(value)}</text>`
}

/** Горизонтальная размерная линия с засечками и подписью. */
export function dimensionH(x1: number, x2: number, y: number, label: string, size = 10): string {
  const middle = (x1 + x2) / 2
  return [
    line(x1, y - 4, x1, y + 4, { stroke: THIN }),
    line(x2, y - 4, x2, y + 4, { stroke: THIN }),
    line(x1, y, x2, y, { stroke: THIN }),
    `<rect x="${(middle - label.length * size * 0.32).toFixed(1)}" y="${(y - size * 0.8).toFixed(1)}" width="${(label.length * size * 0.64).toFixed(1)}" height="${(size * 1.2).toFixed(1)}" fill="#ffffff"/>`,
    text(middle, y + size * 0.35, label, { size, fill: THIN }),
  ].join('')
}

/** Вертикальная размерная линия. */
export function dimensionV(y1: number, y2: number, x: number, label: string, size = 10): string {
  const middle = (y1 + y2) / 2
  return [
    line(x - 4, y1, x + 4, y1, { stroke: THIN }),
    line(x - 4, y2, x + 4, y2, { stroke: THIN }),
    line(x, y1, x, y2, { stroke: THIN }),
    `<rect x="${(x - size * 0.7).toFixed(1)}" y="${(middle - label.length * size * 0.32).toFixed(1)}" width="${(size * 1.4).toFixed(1)}" height="${(label.length * size * 0.64).toFixed(1)}" fill="#ffffff"/>`,
    text(x, middle, label, { size, fill: THIN, rotate: -90 }),
  ].join('')
}

export function svgDocument(width: number, height: number, body: string, title: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeText(title)}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    body,
    '</svg>',
  ].join('')
}

/** SVG в data URL — для скачивания и вставки в <img>. */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
