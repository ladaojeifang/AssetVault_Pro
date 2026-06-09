import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { itemDirAbsolute } from './libraryBundle'

export const THUMB_FAILED_MARKER = '.thumb-failed'

/** Matches AsyncThumbnailJob.id values. */
export type ThumbSkipPipeline = 'model3d' | 'embedded-dcc' | 'text-preview'

const VALID_PIPELINES = new Set<string>(['model3d', 'embedded-dcc', 'text-preview'])

function markerPath(assetId: string): string {
  return join(itemDirAbsolute(assetId), THUMB_FAILED_MARKER)
}

function readMarkerContent(assetId: string): string | null {
  const p = markerPath(assetId)
  if (!existsSync(p)) return null
  try {
    return readFileSync(p, 'utf8').trim()
  } catch {
    return null
  }
}

function parsePipeline(content: string): ThumbSkipPipeline | null {
  const idx = content.indexOf(':')
  const head = (idx >= 0 ? content.slice(0, idx) : content).trim()
  return VALID_PIPELINES.has(head) ? (head as ThumbSkipPipeline) : null
}

/** True when any async thumb pipeline marked this asset failed. */
export function isThumbnailSkipped(assetId: string): boolean {
  return readMarkerContent(assetId) != null
}

/** True when the given pipeline (or any, if omitted) marked failure. */
export function isThumbnailSkippedForPipeline(
  assetId: string,
  pipeline?: ThumbSkipPipeline
): boolean {
  const content = readMarkerContent(assetId)
  if (content == null) return false
  if (!pipeline) return true
  const marked = parsePipeline(content)
  if (marked) return marked === pipeline
  return true
}

export function getThumbnailSkipReason(assetId: string): string | null {
  const content = readMarkerContent(assetId)
  if (content == null) return null
  const idx = content.indexOf(':')
  return idx >= 0 ? content.slice(idx + 1).trim() || null : content
}

export function markThumbnailSkipped(
  assetId: string,
  pipeline: ThumbSkipPipeline,
  reason?: string
): void {
  const dir = itemDirAbsolute(assetId)
  mkdirSync(dir, { recursive: true })
  const body = `${pipeline}:${(reason ?? 'skip').slice(0, 200)}`
  writeFileSync(markerPath(assetId), body, 'utf8')
}

export function clearThumbnailSkip(assetId: string, pipeline?: ThumbSkipPipeline): void {
  const p = markerPath(assetId)
  if (!existsSync(p)) return
  if (!pipeline) {
    unlinkSync(p)
    return
  }
  if (isThumbnailSkippedForPipeline(assetId, pipeline)) {
    unlinkSync(p)
  }
}

/** @deprecated Use thumbnailSkip.ts names — kept for gradual migration. */
export const isModelThumbnailSkipped = isThumbnailSkipped
export const markModelThumbnailSkipped = (
  assetId: string,
  reason?: string
): void => markThumbnailSkipped(assetId, 'model3d', reason)
export const clearModelThumbnailSkip = clearThumbnailSkip
