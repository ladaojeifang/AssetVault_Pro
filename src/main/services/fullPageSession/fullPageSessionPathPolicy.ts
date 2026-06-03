import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join, resolve, sep, extname, normalize } from 'path'
import { getLibraryRoot } from '../libraryBundle'

const STRIP_EXT = new Set(['.jpg', '.jpeg', '.png'])
const REMOTE_IMPORTS_DIR = 'remote-imports'

export function buildFullPageTempRoot(): string {
  return join(getLibraryRoot(), REMOTE_IMPORTS_DIR)
}

/** Marker file: purge must not delete this session directory (debug / strip inspection). */
export const FULLPAGE_KEEP_STRIPS_MARKER = '.assetvault-keep-strips'

export function markSessionDirPreserved(
  tempDir: string,
  meta: Record<string, unknown>
): void {
  const path = join(tempDir, FULLPAGE_KEEP_STRIPS_MARKER)
  writeFileSync(
    path,
    JSON.stringify({ ...meta, keptAt: new Date().toISOString() }, null, 2),
    'utf8'
  )
}

export function isPreservedSessionDir(dir: string): boolean {
  try {
    return existsSync(join(dir, FULLPAGE_KEEP_STRIPS_MARKER))
  } catch {
    return false
  }
}

/** True if directory still has strip-*.jpg/png (do not orphan-purge). */
export function dirHasStripFiles(dir: string): boolean {
  try {
    if (!existsSync(dir)) return false
    for (const name of readdirSync(dir)) {
      if (/^strip-\d{4}\.(jpe?g|png)$/i.test(name)) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function fullPageStripFileName(
  stripIndex: number,
  format: 'jpeg' | 'png'
): string {
  const ext = format === 'png' ? 'png' : 'jpg'
  return `strip-${String(stripIndex).padStart(4, '0')}.${ext}`
}

export function createSessionTempDir(sessionId: string): string {
  if (!/^inspect-\d+$/.test(sessionId)) {
    throw new Error('INVALID_REQUEST')
  }
  const tempDir = join(buildFullPageTempRoot(), sessionId)
  mkdirSync(tempDir, { recursive: true })
  return resolve(tempDir)
}

export function isAllowedStripExtension(filePath: string): boolean {
  return STRIP_EXT.has(extname(filePath).toLowerCase())
}

/** Resolved path must stay under resolved tempDir (no `..`, no symlink escape). */
export function assertStripPathInSessionDir(filePath: string, tempDir: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
  const resolvedDir = resolveRealDir(tempDir)
  let resolvedFile: string
  try {
    resolvedFile = resolve(filePath)
  } catch {
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
  if (!isAllowedStripExtension(resolvedFile)) {
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
  if (resolvedFile.includes('..')) {
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
  const prefix = resolvedDir.endsWith(sep) ? resolvedDir : resolvedDir + sep
  const normFile = normalize(resolvedFile)
  const normDir = normalize(resolvedDir)
  if (process.platform === 'win32') {
    if (!normFile.toLowerCase().startsWith(normDir.toLowerCase() + sep.toLowerCase())) {
      throw new Error('FULLPAGE_STRIP_PATH_DENIED')
    }
  } else if (!normFile.startsWith(normDir + sep)) {
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
  if (!existsSync(resolvedFile)) {
    throw new Error('FULLPAGE_STRIP_DECODE_FAILED')
  }
  const st = lstatSync(resolvedFile)
  if (!st.isFile()) {
    throw new Error('FULLPAGE_STRIP_DECODE_FAILED')
  }
  if (st.isSymbolicLink()) {
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
  try {
    const realFile = realpathSync(resolvedFile)
    const realDir = realpathSync(resolvedDir)
    const realPrefix = realDir.endsWith(sep) ? realDir : realDir + sep
    if (process.platform === 'win32') {
      if (!realFile.toLowerCase().startsWith(realPrefix.toLowerCase())) {
        throw new Error('FULLPAGE_STRIP_PATH_DENIED')
      }
    } else if (!realFile.startsWith(realPrefix)) {
      throw new Error('FULLPAGE_STRIP_PATH_DENIED')
    }
    return realFile
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('FULLPAGE_')) throw e
    throw new Error('FULLPAGE_STRIP_PATH_DENIED')
  }
}

function resolveRealDir(tempDir: string): string {
  const resolved = resolve(tempDir)
  if (!existsSync(resolved)) {
    throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  }
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

export function removeDirRecursive(dir: string): number {
  if (!existsSync(dir)) return 0
  try {
    rmSync(dir, { recursive: true, force: true })
    return 1
  } catch {
    return 0
  }
}
