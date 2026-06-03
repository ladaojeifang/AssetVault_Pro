import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFileSync, writeFileSync } from 'fs'
import { Transformer } from '@napi-rs/image'
import type { FullPageOutputFormat, FullPageWarningCode } from '@/shared/fullPageSessionTypes'

export type StripInput = {
  filePath: string
  stripHeightPx: number
  widthPx: number
}

export type StitchPlan = {
  widthPx: number
  heightPx: number
  overlapPx: number
  maxOutputPixels: number
  maxOutputSide: number
  maxOutputBytes: number
  format: FullPageOutputFormat
  quality: number
  plannedStripCount?: number
  allowPartial: boolean
}

export type StitchResult = {
  outputPath: string
  widthPx: number
  heightPx: number
  format: FullPageOutputFormat
  fileBytes: number
  scaledDown: boolean
  warnings: FullPageWarningCode[]
}

export async function readStripDimensions(
  filePath: string
): Promise<{ width: number; height: number }> {
  const buf = readFileSync(filePath)
  const meta = await new Transformer(buf).metadata()
  if (!meta.width || !meta.height) {
    throw new Error('FULLPAGE_STRIP_DECODE_FAILED')
  }
  return { width: meta.width, height: meta.height }
}

export function computeStitchedHeight(
  stripHeights: number[],
  overlapPx: number
): { heightPx: number; overlapUsed: number; warnings: FullPageWarningCode[] } {
  const warnings: FullPageWarningCode[] = []
  let overlap = Math.max(0, Math.floor(overlapPx))
  if (stripHeights.length === 0) return { heightPx: 0, overlapUsed: 0, warnings }
  const maxOverlap = Math.min(...stripHeights.slice(1).map((h, i) => h), stripHeights[0] ?? 0)
  if (stripHeights.length > 1 && overlap >= maxOverlap) {
    overlap = Math.max(0, maxOverlap - 1)
    warnings.push('overlap_clamped')
  }
  const sum = stripHeights.reduce((a, b) => a + b, 0)
  const heightPx = sum - overlap * Math.max(0, stripHeights.length - 1)
  return { heightPx: Math.max(1, heightPx), overlapUsed: overlap, warnings }
}

export function computeOutputScale(
  widthPx: number,
  heightPx: number,
  maxOutputPixels: number,
  maxOutputSide: number
): { scale: number; scaledDown: boolean } {
  if (widthPx <= 0 || heightPx <= 0) return { scale: 1, scaledDown: false }
  const pixels = widthPx * heightPx
  let scale = 1
  if (pixels > maxOutputPixels) {
    scale = Math.min(scale, Math.sqrt(maxOutputPixels / pixels))
  }
  if (heightPx > maxOutputSide) {
    scale = Math.min(scale, maxOutputSide / heightPx)
  }
  if (widthPx > maxOutputSide) {
    scale = Math.min(scale, maxOutputSide / widthPx)
  }
  if (scale >= 1) return { scale: 1, scaledDown: false }
  return { scale, scaledDown: true }
}

export async function stitchVerticalToFile(
  strips: StripInput[],
  plan: StitchPlan,
  outputPath: string
): Promise<StitchResult> {
  if (strips.length === 0) throw new Error('FULLPAGE_SESSION_EMPTY')

  const widths = strips.map((s) => s.widthPx)
  const W = widths[0]!
  if (widths.some((w) => Math.abs(w - W) > 1)) {
    throw new Error('FULLPAGE_STRIP_DIMENSION_MISMATCH')
  }

  const heights = strips.map((s) => s.stripHeightPx)
  const { heightPx: H, overlapUsed, warnings: overlapWarnings } = computeStitchedHeight(
    heights,
    plan.overlapPx
  )
  const warnings: FullPageWarningCode[] = [...overlapWarnings]

  if (
    plan.plannedStripCount != null &&
    plan.plannedStripCount > strips.length &&
    plan.allowPartial
  ) {
    warnings.push('capture_incomplete')
  }

  const { scale, scaledDown } = computeOutputScale(
    W,
    H,
    plan.maxOutputPixels,
    plan.maxOutputSide
  )
  if (scaledDown) warnings.push('output_scaled_down')

  const outW = Math.max(1, Math.floor(W * scale))
  const outH = Math.max(1, Math.floor(H * scale))

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  let destY = 0
  for (let i = 0; i < strips.length; i++) {
    const strip = strips[i]!
    const img = await loadImage(strip.filePath)
    const srcH = Math.min(strip.stripHeightPx, img.height)
    const cropTop = i > 0 ? Math.min(overlapUsed, Math.max(0, srcH - 1)) : 0
    const drawH = srcH - cropTop
    if (drawH <= 0) continue
    ctx.drawImage(img, 0, cropTop, W, drawH, 0, destY, W, drawH)
    destY += drawH
  }

  let exportCanvas = canvas
  if (scale < 1) {
    const scaled = createCanvas(outW, outH)
    const sctx = scaled.getContext('2d')
    sctx.drawImage(canvas, 0, 0, outW, outH)
    exportCanvas = scaled
  }

  const quality = Math.min(100, Math.max(1, Math.floor(plan.quality)))
  let buf: Buffer
  if (plan.format === 'png') {
    buf = exportCanvas.toBuffer('image/png')
  } else {
    buf = exportCanvas.toBuffer('image/jpeg', { quality })
  }

  if (buf.byteLength > plan.maxOutputBytes) {
    throw new Error('FULLPAGE_DIMENSION_LIMIT')
  }

  writeFileSync(outputPath, buf)

  return {
    outputPath,
    widthPx: outW,
    heightPx: outH,
    format: plan.format,
    fileBytes: buf.byteLength,
    scaledDown,
    warnings
  }
}
