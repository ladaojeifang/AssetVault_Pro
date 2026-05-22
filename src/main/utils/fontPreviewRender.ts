import { createCanvas } from '@napi-rs/canvas'
import type { Font } from 'fontkit'
import type { FontPreviewRenderRequest } from '@/shared/fontTypes'
import { openFontFaceFromFile } from '../services/fontMetadata'

export const FONT_THUMB_CANVAS_SIZE = 512

const DEFAULT_BG = '#161822'
const DEFAULT_FG = '#f1f5f9'
const LINE_HEIGHT_FACTOR = 1.34
const WIDTH_SAFETY = 1.1

export type FontPreviewRenderOptions = FontPreviewRenderRequest

function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/)
  return lines.length > 0 ? lines : [text]
}

function measureRunWidth(face: Font, text: string, scale: number, letterSpacingPx: number): number {
  if (!text) return 0
  const run = face.layout(text)
  const upem = face.unitsPerEm || 1000
  const gs = scale / upem
  let width = 0
  for (let i = 0; i < run.glyphs.length; i++) {
    width += run.positions[i].xAdvance * gs
    if (i < run.glyphs.length - 1) width += letterSpacingPx
  }
  return width
}

type InkBox = { minX: number; maxX: number; minY: number; maxY: number }

function measureLineInkBox(
  face: Font,
  text: string,
  scale: number,
  letterSpacingPx: number
): InkBox | null {
  if (!text) return null
  const run = face.layout(text)
  const upem = face.unitsPerEm || 1000
  const gs = scale / upem
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let x = 0
  let hasInk = false

  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i]
    const pos = run.positions[i]
    const gx = x + pos.xOffset * gs
    const gy = pos.yOffset * gs
    try {
      void glyph.path
    } catch {
      /* optional */
    }
    const bbox = glyph.bbox
    if (bbox && Number.isFinite(bbox.minX) && bbox.minX !== Infinity) {
      hasInk = true
      minX = Math.min(minX, gx + bbox.minX * gs)
      maxX = Math.max(maxX, gx + bbox.maxX * gs)
      minY = Math.min(minY, gy - bbox.maxY * gs)
      maxY = Math.max(maxY, gy - bbox.minY * gs)
    }
    x += pos.xAdvance * gs + (i < run.glyphs.length - 1 ? letterSpacingPx : 0)
  }
  if (!hasInk) return null
  return { minX, maxX, minY, maxY }
}

function lineMetrics(face: Font, scale: number, lineHeightMul: number) {
  const upem = face.unitsPerEm || 1000
  const glyphScale = scale / upem
  const ascent = typeof face.ascent === 'number' ? face.ascent : upem * 0.8
  const descent = typeof face.descent === 'number' ? face.descent : upem * 0.2
  const lineGap = typeof face.lineGap === 'number' ? face.lineGap : upem * 0.12
  const lineAdvance = (ascent - descent + lineGap) * glyphScale * LINE_HEIGHT_FACTOR * lineHeightMul
  const textHeight = (ascent - descent) * glyphScale
  return { glyphScale, ascent, descent, lineAdvance, textHeight }
}

function measureLineWidth(face: Font, line: string, scale: number, letterSpacingPx: number): number {
  const ink = measureLineInkBox(face, line, scale, letterSpacingPx)
  const advance = measureRunWidth(face, line, scale, letterSpacingPx)
  if (ink) return Math.max(advance, (ink.maxX - ink.minX) * WIDTH_SAFETY)
  return advance * WIDTH_SAFETY
}

function measureMultiline(
  face: Font,
  lines: string[],
  scale: number,
  lineHeightMul: number,
  letterSpacingPx: number
) {
  const nonEmpty = lines.filter((l) => l.length > 0)
  const lineCount = Math.max(nonEmpty.length, 1)
  const maxWidth = nonEmpty.reduce(
    (m, line) => Math.max(m, measureLineWidth(face, line, scale, letterSpacingPx)),
    0
  )
  const metrics = lineMetrics(face, scale, lineHeightMul)
  const totalHeight = metrics.textHeight + (lineCount - 1) * metrics.lineAdvance
  return { maxWidth, totalHeight, ...metrics }
}

function drawLineWithFontkit(
  face: Font,
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  text: string,
  scale: number,
  baselineX: number,
  baselineY: number,
  letterSpacingPx: number,
  textColor: string
): void {
  if (!ctx || !text) return
  const upem = face.unitsPerEm || 1000
  const glyphScale = scale / upem
  const run = face.layout(text)
  let x = baselineX
  ctx.fillStyle = textColor

  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i]
    const pos = run.positions[i]
    if (!glyph.path) {
      x += pos.xAdvance * glyphScale + (i < run.glyphs.length - 1 ? letterSpacingPx : 0)
      continue
    }
    ctx.save()
    ctx.translate(x + pos.xOffset * glyphScale, baselineY + pos.yOffset * glyphScale)
    ctx.scale(glyphScale, -glyphScale)
    try {
      glyph.path.toFunction()(ctx)
      ctx.fill()
    } catch (e) {
      console.warn('[Font] glyph path draw failed:', e)
    }
    ctx.restore()
    x += pos.xAdvance * glyphScale + (i < run.glyphs.length - 1 ? letterSpacingPx : 0)
  }
}

function alignLineX(
  line: string,
  face: Font,
  scale: number,
  letterSpacingPx: number,
  textAlign: 'left' | 'center' | 'right',
  canvasW: number,
  padding: number
): number {
  const ink = measureLineInkBox(face, line, scale, letterSpacingPx)
  const lineW = measureLineWidth(face, line, scale, letterSpacingPx)
  const contentW = ink ? ink.maxX - ink.minX : lineW
  const inkOffset = ink ? -ink.minX : 0
  if (textAlign === 'left') return padding + inkOffset
  if (textAlign === 'right') return canvasW - padding - contentW + inkOffset
  return (canvasW - contentW) / 2 + inkOffset
}

function fitScale(
  face: Font,
  lines: string[],
  canvasW: number,
  canvasH: number,
  padding: number,
  lineHeightMul: number,
  letterSpacingPx: number,
  fontSizePx?: number
): number {
  if (fontSizePx && fontSizePx > 0) {
    const upem = face.unitsPerEm || 1000
    const ascent = typeof face.ascent === 'number' ? face.ascent : upem * 0.8
    return (fontSizePx * upem) / ascent
  }
  let scale = 96
  const maxW = canvasW - padding * 2
  const maxH = canvasH - padding * 2
  while (scale > 6) {
    const m = measureMultiline(face, lines, scale, lineHeightMul, letterSpacingPx)
    if (m.maxWidth <= maxW && m.totalHeight <= maxH) break
    scale -= 2
  }
  return scale
}

export function renderFontPreviewPngWithOptions(
  filePath: string,
  options: FontPreviewRenderOptions
): Buffer | null {
  try {
    const ttcIndex = options.ttcIndex ?? 0
    const opened = openFontFaceFromFile(filePath, ttcIndex)
    if (!opened) return null
    const { face } = opened

    const canvasW = options.canvasWidth ?? FONT_THUMB_CANVAS_SIZE
    const canvasH = options.canvasHeight ?? FONT_THUMB_CANVAS_SIZE
    const padding = Math.round(Math.min(canvasW, canvasH) * 0.07)
    const lineHeightMul = options.lineHeight ?? 1.34
    const letterSpacingPx = options.letterSpacingPx ?? 0
    const textAlign = options.textAlign ?? 'center'
    const bg = options.backgroundColor ?? DEFAULT_BG
    const fg = options.textColor ?? DEFAULT_FG
    const lines = splitLines(options.sampleText)

    const canvas = createCanvas(canvasW, canvasH)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvasW, canvasH)

    const scale = fitScale(
      face,
      lines,
      canvasW,
      canvasH,
      padding,
      lineHeightMul / LINE_HEIGHT_FACTOR,
      letterSpacingPx,
      options.fontSizePx
    )
    const metrics = measureMultiline(face, lines, scale, lineHeightMul / LINE_HEIGHT_FACTOR, letterSpacingPx)
    const blockTop = (canvasH - metrics.totalHeight) / 2

    let lineIndex = 0
    for (const line of lines) {
      if (!line) continue
      const x = alignLineX(line, face, scale, letterSpacingPx, textAlign, canvasW, padding)
      const baselineY = blockTop + metrics.ascent * metrics.glyphScale + lineIndex * metrics.lineAdvance
      drawLineWithFontkit(face, ctx, line, scale, x, baselineY, letterSpacingPx, fg)
      lineIndex++
    }

    return canvas.toBuffer('image/png')
  } catch (error) {
    console.error(`[Font] Preview render failed for ${filePath}:`, error)
    return null
  }
}

/** Thumbnail-sized render (auto-fit, square). */
export function renderFontPreviewPng(filePath: string, sampleText: string, ttcIndex = 0): Buffer | null {
  return renderFontPreviewPngWithOptions(filePath, {
    filePath,
    sampleText,
    ttcIndex,
    canvasWidth: FONT_THUMB_CANVAS_SIZE,
    canvasHeight: FONT_THUMB_CANVAS_SIZE
  })
}
