import { Transformer, ResizeFit } from '@napi-rs/image'

export const PALETTE_COLOR_COUNT = 10
const SAMPLE_MAX_EDGE = 80
/** RGB buckets per channel (4 → 16 levels) */
const QUANT_BITS = 4

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function colorDistance(hex1: string, hex2: string): number {
  const a = hexToRgb(hex1)
  const b = hexToRgb(hex2)
  if (!a || !b) return 999
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

type Bucket = { r: number; g: number; b: number; count: number }

/**
 * Extract top N distinct colors from an image buffer (PNG/JPEG/WebP…).
 */
export async function extractPaletteFromImageBuffer(
  fileBuffer: Buffer,
  count: number = PALETTE_COLOR_COUNT
): Promise<{ dominantColor: string; colors: string[] }> {
  const transformer = new Transformer(fileBuffer)
  const pixels = await transformer
    .resize(SAMPLE_MAX_EDGE, SAMPLE_MAX_EDGE, undefined, ResizeFit.Inside)
    .rawPixels()

  const shift = 8 - QUANT_BITS
  const buckets = new Map<number, Bucket>()

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3]
    if (a < 40) continue
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const qr = r >> shift
    const qg = g >> shift
    const qb = b >> shift
    const key = (qr << 8) | (qg << 4) | qb
    const prev = buckets.get(key)
    if (prev) {
      prev.r += r
      prev.g += g
      prev.b += b
      prev.count++
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
  }

  const ranked = [...buckets.values()]
    .map((b) => ({
      r: b.r / b.count,
      g: b.g / b.count,
      b: b.b / b.count,
      count: b.count
    }))
    .sort((x, y) => y.count - x.count)

  const pick = (minDist: number): string[] => {
    const out: string[] = []
    for (const item of ranked) {
      const hex = rgbToHex(item.r, item.g, item.b)
      if (out.some((c) => colorDistance(c, hex) < minDist)) continue
      out.push(hex)
      if (out.length >= count) break
    }
    return out
  }

  let palette = pick(28)
  if (palette.length < count) {
    for (const item of ranked) {
      const hex = rgbToHex(item.r, item.g, item.b)
      if (!palette.includes(hex)) palette.push(hex)
      if (palette.length >= count) break
    }
  }

  if (palette.length === 0) {
    palette = ['#808080']
  }

  while (palette.length < count) {
    palette.push(palette[palette.length - 1] ?? palette[0])
  }

  const colors = palette.slice(0, count)
  return { dominantColor: colors[0], colors }
}

export function serializePaletteColors(colors: string[]): string {
  return JSON.stringify(colors)
}

export function parsePaletteColors(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((c): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.trim()))
      .map((c) => c.toUpperCase())
      .slice(0, PALETTE_COLOR_COUNT)
  } catch {
    return []
  }
}
