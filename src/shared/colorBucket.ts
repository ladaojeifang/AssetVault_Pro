/** Hue-based color families for asset filtering (PRD filter bar). */
export type ColorBucket =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'neutral'

export const COLOR_BUCKET_OPTIONS: ReadonlyArray<{
  id: ColorBucket
  label: string
  hex: string
}> = [
  { id: 'red', label: '红', hex: '#EF4444' },
  { id: 'orange', label: '橙', hex: '#F97316' },
  { id: 'yellow', label: '黄', hex: '#EAB308' },
  { id: 'green', label: '绿', hex: '#22C55E' },
  { id: 'cyan', label: '青', hex: '#06B6D4' },
  { id: 'blue', label: '蓝', hex: '#3B82F6' },
  { id: 'purple', label: '紫', hex: '#A855F7' },
  { id: 'pink', label: '粉', hex: '#EC4899' },
  { id: 'neutral', label: '灰', hex: '#94A3B8' }
] as const

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: h * 360, s, l }
}

/** Classify #RRGGBB into a filter bucket; null if invalid. */
export function classifyColorBucket(hex: string | null | undefined): ColorBucket | null {
  if (!hex?.trim()) return null
  const rgb = parseHex(hex)
  if (!rgb) return null
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  if (s < 0.12 || l < 0.12 || l > 0.92) return 'neutral'
  if (h < 15 || h >= 345) return 'red'
  if (h < 45) return 'orange'
  if (h < 70) return 'yellow'
  if (h < 155) return 'green'
  if (h < 200) return 'cyan'
  if (h < 255) return 'blue'
  if (h < 295) return 'purple'
  return 'pink'
}
