import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from 'fs'
import { homedir } from 'os'
import { join, resolve, sep, normalize } from 'path'
import { app } from 'electron'
import { isArticleBundleExtension } from '@/shared/assetFormatRegistry'

export function resolveDownloadsBase(): string {
  try {
    return app.getPath('downloads')
  } catch {
    return join(homedir(), 'Downloads')
  }
}

export function buildArticleBundleTempRoot(): string {
  return join(resolveDownloadsBase(), 'AssetVault_Temp', 'article')
}

export function createArticleSessionTempDir(sessionId: string): string {
  const tempDir = join(buildArticleBundleTempRoot(), sessionId)
  mkdirSync(tempDir, { recursive: true })
  return resolve(tempDir)
}

export function isAllowedBundleExtension(filePath: string): boolean {
  return isArticleBundleExtension(filePath)
}

/** Resolved path must stay under resolved tempDir (no `..`, no symlink escape). */
export function assertBundlePathInSessionDir(filePath: string, tempDir: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  const resolvedDir = resolveRealDir(tempDir)
  let resolvedFile: string
  try {
    resolvedFile = resolve(filePath)
  } catch {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  if (!isAllowedBundleExtension(resolvedFile)) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  if (resolvedFile.includes('..')) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  const prefix = resolvedDir.endsWith(sep) ? resolvedDir : resolvedDir + sep
  const normFile = normalize(resolvedFile)
  const normDir = normalize(resolvedDir)
  if (process.platform === 'win32') {
    if (!normFile.toLowerCase().startsWith(normDir.toLowerCase() + sep.toLowerCase())) {
      throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
    }
  } else if (!normFile.startsWith(normDir + sep)) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  if (!existsSync(resolvedFile)) {
    throw new Error('ARTICLE_BUNDLE_FILE_NOT_FOUND')
  }
  const st = lstatSync(resolvedFile)
  if (!st.isFile()) {
    throw new Error('ARTICLE_BUNDLE_FILE_NOT_FOUND')
  }
  if (st.isSymbolicLink()) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  try {
    const realFile = realpathSync(resolvedFile)
    const realDir = realpathSync(resolvedDir)
    const realPrefix = realDir.endsWith(sep) ? realDir : realDir + sep
    if (process.platform === 'win32') {
      if (!realFile.toLowerCase().startsWith(realPrefix.toLowerCase())) {
        throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
      }
    } else if (!realFile.startsWith(realPrefix)) {
      throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
    }
    return realFile
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('ARTICLE_BUNDLE_')) throw e
    // Junction / cloud placeholder: normalized prefix already verified
    return resolvedFile
  }
}

function resolveRealDir(tempDir: string): string {
  const resolved = resolve(tempDir)
  if (!existsSync(resolved)) {
    throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')
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
