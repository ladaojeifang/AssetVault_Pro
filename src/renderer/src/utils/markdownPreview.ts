import type { AssetItem } from '@/shared/types'
import { getMimeForExtension } from '@/shared/assetFormatRegistry'
import { canAssetPreview } from '@/shared/assetPreviewRegistry'

export function isMarkdownPreviewAsset(asset: {
  extension?: string
  fileType?: string
}): boolean {
  return canAssetPreview(asset, 'markdown')
}

export function markdownContentPath(asset: AssetItem): string {
  return asset.resolvedFilePath ?? asset.filePath
}

/** Join md file directory with a relative or root-relative asset path. */
export function joinMarkdownMediaPath(contentFilePath: string, src: string): string {
  const s = src.trim()
  if (!s || /^https?:/i.test(s) || /^data:/i.test(s) || /^blob:/i.test(s) || /^file:/i.test(s)) {
    return s
  }
  const norm = contentFilePath.replace(/\\/g, '/')
  const slash = norm.lastIndexOf('/')
  const base = slash >= 0 ? norm.slice(0, slash) : norm
  const rel = s.replace(/^\.\//, '').replace(/\\/g, '/')
  return `${base}/${rel}`
}

function mimeForImagePath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return getMimeForExtension(ext) ?? 'application/octet-stream'
}

/**
 * Load local bundle images for <img> in sandboxed renderer.
 * file:// is blocked from http://localhost; use blob: URLs (same as SVG preview).
 */
export async function loadMarkdownImageObjectUrl(
  contentFilePath: string,
  src: string | undefined
): Promise<string | undefined> {
  if (!src) return undefined
  const s = src.trim()
  if (/^(https?:|data:|blob:)/i.test(s)) return s

  const absPath = joinMarkdownMediaPath(contentFilePath, s)
  if (!absPath || /^https?:/i.test(absPath)) return undefined

  try {
    const bytes = await window.assetVaultAPI.fs.readFileBytes(absPath)
    if (!bytes?.byteLength) return undefined
    const blob = new Blob([bytes], { type: mimeForImagePath(absPath) })
    return URL.createObjectURL(blob)
  } catch {
    return undefined
  }
}

export function revokeMarkdownImageObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/** @deprecated Use loadMarkdownImageObjectUrl — file:// does not work in the renderer. */
export async function resolveMarkdownMediaSrc(
  contentFilePath: string,
  src: string | undefined
): Promise<string | undefined> {
  return loadMarkdownImageObjectUrl(contentFilePath, src)
}
