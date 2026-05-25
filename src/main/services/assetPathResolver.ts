import { existsSync } from 'fs'
import { isAbsolute, normalize } from 'path'
import { resolveLibraryPath } from './libraryBundle'
import type { StorageMode } from '@/shared/libraryTypes'

export type AssetPathRow = {
  filePath: string
  storageMode?: string | null
}

/** Absolute path to the asset's content file (library copy or external source). */
export function resolveAssetContentPath(row: AssetPathRow): string {
  const mode = row.storageMode ?? (isAbsolute(row.filePath.trim()) ? 'referenced' : 'local')
  if (mode === 'referenced' || isAbsolute(row.filePath.trim())) {
    return normalize(row.filePath.trim())
  }
  return resolveLibraryPath(row.filePath)
}

export function isAssetSourceMissing(row: AssetPathRow): boolean {
  const mode = row.storageMode ?? (isAbsolute(row.filePath.trim()) ? 'referenced' : 'local')
  if (mode !== 'referenced') return false
  const abs = resolveAssetContentPath(row)
  return !abs || !existsSync(abs)
}
