import type { FileType } from '@/shared/types'
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  FONT_EXTENSIONS,
  DESIGN_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  THREED_EXTENSIONS,
  CODE_EXTENSIONS
} from '@/shared/supportedFormats'

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/tiff',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/x-adobe-dng',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw'
])

const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/x-msvideo',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/x-ms-wmv',
  'video/mpeg',
  'video/3gpp',
  'video/x-m4v'
])

const AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/ogg',
  'audio/x-ms-wma',
  'audio/mp4',
  'audio/aiff',
  'audio/x-aiff',
  'audio/opus',
  'audio/webm'
])

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

  if (FONT_EXTENSIONS.has(e)) return 'font'
  if (CODE_EXTENSIONS.has(e)) return 'code'
  if (DOCUMENT_EXTENSIONS.has(e)) return 'document'
  if (DESIGN_EXTENSIONS.has(e)) return 'design'
  if (THREED_EXTENSIONS.has(e)) return '3d'
  if (IMAGE_EXTENSIONS.has(e)) return 'image'
  if (VIDEO_EXTENSIONS.has(e)) return 'video'
  if (AUDIO_EXTENSIONS.has(e)) return 'audio'

  if (IMAGE_MIMES.has(mimeType)) return 'image'
  if (VIDEO_MIMES.has(mimeType)) return 'video'
  if (AUDIO_MIMES.has(mimeType)) return 'audio'

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
