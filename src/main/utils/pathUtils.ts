import { normalize, resolve } from 'path'
import { realpathSync } from 'fs'

function normalizeWindowsPath(p: string): string {
  if (process.platform === 'win32' && /^[a-zA-Z]:[\\/]/.test(p)) {
    return p[0].toUpperCase() + p.slice(1)
  }
  return p
}

/**
 * Single canonical form for DB `file_path` (reduces duplicate imports from watcher vs IPC).
 * Uses realpath when the file exists so casing/symlinks match the OS.
 */
export function toCanonicalFilePath(filePath: string): string {
  const resolved = normalizeWindowsPath(resolve(normalize(filePath.trim())))
  try {
    return normalizeWindowsPath(realpathSync(resolved))
  } catch {
    return resolved
  }
}

export function isSqliteUniqueFilePathError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('UNIQUE') && msg.includes('file_path')
}
