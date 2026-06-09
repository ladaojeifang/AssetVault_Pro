import { isModel3dPreviewExtension } from './model3dFormats'
import { isEmbeddedDccThumbExtension } from './embeddedDccFormats'
import { isTextPreviewExtension } from './textPreviewFormats'

function dotExt(extension: string): string {
  const e = extension.replace(/^\./, '').toLowerCase()
  return e ? `.${e}` : ''
}

/** Thumbnails generated asynchronously after import (3D render / DCC extract / text canvas). */
export function isDeferredThumbnailAsset(fileType: string, extension: string): boolean {
  if (fileType === '3d') {
    const ext = extension.replace(/^\./, '').toLowerCase()
    return isModel3dPreviewExtension(ext) || isEmbeddedDccThumbExtension(dotExt(ext))
  }
  if (fileType === 'code' || fileType === 'document') {
    return isTextPreviewExtension(dotExt(extension))
  }
  return false
}

/** Grid should mount ThumbnailImage and poll IPC while async thumb is still generating. */
export function shouldRetryThumbnailWhileEmpty(
  fileType: string,
  extension: string,
  hasThumbnail: boolean
): boolean {
  return isDeferredThumbnailAsset(fileType, extension) && !hasThumbnail
}

/** Grid should try ThumbnailImage instead of a static placeholder. */
export function shouldRenderThumbnailImage(
  fileType: string,
  extension: string,
  hasThumbnail: boolean
): boolean {
  if (fileType === 'image' || fileType === 'video' || fileType === 'font') return true
  if (hasThumbnail) return true
  return isDeferredThumbnailAsset(fileType, extension)
}
