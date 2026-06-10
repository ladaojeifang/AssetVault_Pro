import type { FileType } from '@/shared/types'
import {
  getFileTypeFromExtension,
  getFileTypeFromMime
} from '@/shared/assetFormatRegistry'

function normalizeExt(ext: string): string {
  const e = ext.toLowerCase().trim()
  return e.startsWith('.') ? e : `.${e}`
}

/**
 * Classify asset for DB `file_type`. Extension-first so `application/octet-stream`
 * from design/3D/code tools still lands in the right bucket.
 */
export function getFileType(mimeType: string, ext: string): FileType {
  const e = normalizeExt(ext)
  const fromExt = getFileTypeFromExtension(e)
  if (fromExt) return fromExt

  const fromMime = getFileTypeFromMime(mimeType)
  if (fromMime) return fromMime

  return 'other'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function getFileIcon(fileType: FileType, _ext: string): string {
  switch (fileType) {
    case 'image':
      return 'Image'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Audio'
    case 'font':
      return 'Font'
    case 'document':
      return 'Document'
    case 'design':
      return 'Design'
    case '3d':
      return '3D'
    case 'code':
      return 'Code'
    default:
      return 'File'
  }
}
