import { existsSync } from 'fs'
import { isAbsolute, normalize } from 'path'
import { resolveLibraryPath } from './libraryBundle'
import type { StorageMode } from '@/shared/libraryTypes'

export type AssetPathRow = {
  filePath: string | null
  storageMode?: string | null
}

/** Absolute path to the asset's content file (library copy, external source, or embedded in-place). */
export function resolveAssetContentPath(row: AssetPathRow): string {
  const rel = row.filePath?.trim() ?? ''
  if (!rel) return ''
  const mode = row.storageMode ?? (isAbsolute(rel) ? 'referenced' : 'local')
  if (mode === 'referenced' || isAbsolute(rel)) {
    return normalize(rel)
  }
  // 'local' or 'embedded' — both use library-relative path resolution
  return resolveLibraryPath(rel)
}

export function isAssetSourceMissing(row: AssetPathRow): boolean {
  const rel = row.filePath?.trim() ?? ''
  const mode = row.storageMode ?? (rel && isAbsolute(rel) ? 'referenced' : 'local')
  if (mode !== 'referenced') return false
  const abs = resolveAssetContentPath(row)
  return !abs || !existsSync(abs)
}
