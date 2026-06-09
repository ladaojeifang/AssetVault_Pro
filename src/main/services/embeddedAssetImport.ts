import { dirname, normalize, sep } from 'path'
import { toCanonicalFilePath } from '../utils/pathUtils'

/** Parent folder of the embedded library metadata subfolder (`{project}/{name-uuid}/` → `{project}/`). */
export function getEmbeddedProjectRoot(libraryRoot: string): string {
  return normalize(dirname(libraryRoot.trim()))
}

export function isPathUnderRoot(childPath: string, rootPath: string): boolean {
  const child = toCanonicalFilePath(childPath)
  const root = toCanonicalFilePath(rootPath)
  if (child === root) return true
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  return child.startsWith(prefix)
}

/** True when the file already lives under the embedded project tree and should stay in place. */
export function isEmbeddedInPlaceImport(libraryRoot: string, filePathCanonical: string): boolean {
  const libraryRootNorm = toCanonicalFilePath(libraryRoot)
  const projectRootNorm = toCanonicalFilePath(getEmbeddedProjectRoot(libraryRoot))
  const fileNorm = toCanonicalFilePath(filePathCanonical)
  return isPathUnderRoot(fileNorm, libraryRootNorm) || isPathUnderRoot(fileNorm, projectRootNorm)
}
