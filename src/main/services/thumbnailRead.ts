import { readFileSync, existsSync } from 'fs'
import { extname, join } from 'path'
import { ARTICLE_BUNDLE_THUMB_RELATIVE } from '@/shared/articleBundleSessionTypes'
import { getLibraryRoot, itemDirAbsolute, itemThumbRelative, resolveLibraryPath } from './libraryBundle'

export function libraryRelativeFromAbs(absPath: string): string | null {
  try {
    const root = getLibraryRoot().replace(/\\/g, '/').replace(/\/+$/, '')
    const normalized = absPath.replace(/\\/g, '/')
    if (!normalized.startsWith(root + '/')) return null
    return normalized.slice(root.length + 1)
  } catch {
    return null
  }
}

export function mimeTypeForThumbPath(storedPath: string): string {
  const ext = extname(storedPath).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.jfif') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.bmp') return 'image/bmp'
  return 'application/octet-stream'
}

export function articleBundleThumbRelative(assetId: string): string {
  return `items/${assetId}/${ARTICLE_BUNDLE_THUMB_RELATIVE}`.replace(/\\/g, '/')
}

/** Read a library-relative thumbnail file as a data URL with a correct MIME type. */
export function readStoredThumbnailDataUrl(storedPath: string): string | null {
  try {
    const abs = resolveLibraryPath(storedPath.trim())
    if (!existsSync(abs)) return null
    const buffer = readFileSync(abs)
    const mimeType = mimeTypeForThumbPath(storedPath)
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/** Resolve an on-disk thumbnail: article bundle _thumb.jpg, DB path, then thumb.webp. */
export function resolveExistingThumbnailRelPath(
  assetId: string,
  thumbnailPath?: string | null
): string | null {
  const bundleRel = articleBundleThumbRelative(assetId)
  if (existsSync(resolveLibraryPath(bundleRel))) return bundleRel

  const stored = thumbnailPath?.trim()
  if (stored && existsSync(resolveLibraryPath(stored))) return stored

  const defaultRel = itemThumbRelative(assetId)
  if (existsSync(resolveLibraryPath(defaultRel))) return defaultRel

  return null
}

export function articleBundleThumbAbs(assetId: string): string {
  return join(itemDirAbsolute(assetId), ARTICLE_BUNDLE_THUMB_RELATIVE)
}

export function hasArticleBundleThumbOnDisk(assetId: string): boolean {
  try {
    return existsSync(articleBundleThumbAbs(assetId))
  } catch {
    return false
  }
}
