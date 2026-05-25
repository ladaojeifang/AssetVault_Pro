import { copyFileSync, linkSync, existsSync } from 'fs'
import { dirname, normalize, parse } from 'path'

/** Same volume on Windows (drive letter). */
export function isSameVolume(a: string, b: string): boolean {
  const pa = parse(normalize(a))
  const pb = parse(normalize(b))
  if (process.platform === 'win32') {
    return pa.root.toLowerCase() === pb.root.toLowerCase()
  }
  return dirname(normalize(a)) === dirname(normalize(b)) || pa.root === pb.root
}

/**
 * Copy source into library item pack; use hard link on same volume when possible.
 */
export function copyOrHardlinkIntoLibrary(sourceAbs: string, destAbs: string, preferHardlink: boolean): 'copy' | 'hardlink' {
  if (preferHardlink && isSameVolume(sourceAbs, destAbs)) {
    try {
      if (existsSync(destAbs)) {
        /* caller should ensure dest does not exist */
      }
      linkSync(sourceAbs, destAbs)
      return 'hardlink'
    } catch {
      /* fallback */
    }
  }
  copyFileSync(sourceAbs, destAbs)
  return 'copy'
}
