/** Best-effort width/height from SVG text (no rasterizer). */
export function parseSvgDimensions(svgText: string): { width?: number; height?: number } {
  const viewBox = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (viewBox?.[1]) {
    const parts = viewBox[1]
      .trim()
      .split(/[\s,]+/)
      .map((p) => Number.parseFloat(p))
    if (parts.length >= 4 && parts[2]! > 0 && parts[3]! > 0) {
      return { width: Math.round(parts[2]!), height: Math.round(parts[3]!) }
    }
  }

  const widthMatch = svgText.match(/\bwidth\s*=\s*["']([\d.]+)/i)
  const heightMatch = svgText.match(/\bheight\s*=\s*["']([\d.]+)/i)
  const w = widthMatch ? Number.parseFloat(widthMatch[1]!) : NaN
  const h = heightMatch ? Number.parseFloat(heightMatch[1]!) : NaN
  const out: { width?: number; height?: number } = {}
  if (Number.isFinite(w) && w > 0) out.width = Math.round(w)
  if (Number.isFinite(h) && h > 0) out.height = Math.round(h)
  return out
}
