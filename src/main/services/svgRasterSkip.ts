import { existsSync, writeFileSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { MAX_SVG_RASTER_BYTES } from '@/shared/svgFormats'
import { itemDirAbsolute } from './libraryBundle'

export const SVG_RASTER_SKIP_MARKER = '.svg-raster-skipped'

export function isSvgRasterSkipped(assetId: string): boolean {
  return existsSync(join(itemDirAbsolute(assetId), SVG_RASTER_SKIP_MARKER))
}

export function markSvgRasterSkipped(assetId: string, reason?: string): void {
  const dir = itemDirAbsolute(assetId)
  writeFileSync(
    join(dir, SVG_RASTER_SKIP_MARKER),
    (reason ?? 'skip').slice(0, 200),
    'utf-8'
  )
}

export function clearSvgRasterSkip(assetId: string): void {
  const p = join(itemDirAbsolute(assetId), SVG_RASTER_SKIP_MARKER)
  if (existsSync(p)) unlinkSync(p)
}

export function isSvgFileOverRasterLimit(absFilePath: string): boolean {
  try {
    const st = statSync(absFilePath)
    return st.isFile() && st.size > MAX_SVG_RASTER_BYTES
  } catch {
    return true
  }
}

/** Extract asset id from `.../items/{id}/file.svg`. */
export function assetIdFromItemPackPath(absFilePath: string): string | null {
  const m = absFilePath.replace(/\\/g, '/').match(/\/items\/([^/]+)\//i)
  return m?.[1] ?? null
}
