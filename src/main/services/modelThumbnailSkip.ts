import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { itemDirAbsolute } from './libraryBundle'

export const THUMB_FAILED_MARKER = '.thumb-failed'

export function isModelThumbnailSkipped(assetId: string): boolean {
  return existsSync(join(itemDirAbsolute(assetId), THUMB_FAILED_MARKER))
}

export function markModelThumbnailSkipped(assetId: string, reason?: string): void {
  const dir = itemDirAbsolute(assetId)
  writeFileSync(join(dir, THUMB_FAILED_MARKER), (reason ?? 'skip').slice(0, 200), 'utf-8')
}

export function clearModelThumbnailSkip(assetId: string): void {
  const p = join(itemDirAbsolute(assetId), THUMB_FAILED_MARKER)
  if (existsSync(p)) unlinkSync(p)
}
