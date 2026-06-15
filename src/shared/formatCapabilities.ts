/**
 * Format-driven capability registry.
 *
 * Extension is the technical source of truth for import / thumbnail / preview pipelines.
 * `defaultFileType` is derived for sidebar filter labels and DB storage — not behavior authority.
 */

import type { FileType } from './types'
import {
  normalizeExtNoDot,
  getFileTypeFromExtension,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  FONT_EXTENSIONS,
  isSvgExtension,
  isExrExtension,
  isModel3dPreviewExtension,
  isEmbeddedDccThumbExtension,
  isTextPreviewExtension,
  isMarkdownExtension
} from './assetFormatRegistry'

export type ImportPipelineKind = 'image' | 'video' | 'audio' | 'font' | 'none'
export type ImagePipelineKind = 'svg' | 'exr' | 'raster'
export type AsyncThumbnailKind = 'model3d' | 'embedded-dcc' | 'text-preview'

export interface FormatCapabilities {
  /** Normalized extension without leading dot */
  extension: string
  /** Sidebar filter default — derived from extension at import */
  defaultFileType: FileType
  /** Synchronous import processing branch */
  importPipeline: ImportPipelineKind
  imagePipeline?: ImagePipelineKind
  /** Post-import async thumbnail job, if any */
  asyncThumbnail: AsyncThumbnailKind | null
  /** Copy companion .mtl when importing OBJ in archive mode */
  copyObjCompanionMtl: boolean
}

function resolveImportPipeline(ext: string): ImportPipelineKind {
  const dot = `.${ext}`
  if (IMAGE_EXTENSIONS.has(dot)) return 'image'
  if (VIDEO_EXTENSIONS.has(dot)) return 'video'
  if (AUDIO_EXTENSIONS.has(dot)) return 'audio'
  if (FONT_EXTENSIONS.has(dot)) return 'font'
  return 'none'
}

function resolveImagePipeline(ext: string): ImagePipelineKind {
  if (isSvgExtension(ext)) return 'svg'
  if (isExrExtension(ext)) return 'exr'
  return 'raster'
}

/** Resolve async thumbnail job kind from extension only. */
export function resolveAsyncThumbnailKind(extension: string): AsyncThumbnailKind | null {
  const ext = normalizeExtNoDot(extension)
  if (isModel3dPreviewExtension(ext)) return 'model3d'
  if (isEmbeddedDccThumbExtension('.' + ext)) return 'embedded-dcc'
  if (isTextPreviewExtension('.' + ext)) return 'text-preview'
  return null
}

/** Full capability snapshot for one extension. */
export function resolveFormatCapabilities(extension: string): FormatCapabilities {
  const ext = normalizeExtNoDot(extension)
  const dot = `.${ext}`
  const importPipeline = resolveImportPipeline(ext)

  return {
    extension: ext,
    defaultFileType: getFileTypeFromExtension(dot) ?? 'other',
    importPipeline,
    imagePipeline: importPipeline === 'image' ? resolveImagePipeline(ext) : undefined,
    asyncThumbnail: resolveAsyncThumbnailKind(ext),
    copyObjCompanionMtl: ext === 'obj'
  }
}

export function isDeferredThumbnailExtension(extension: string): boolean {
  return resolveAsyncThumbnailKind(extension) !== null
}

/** Grid should mount ThumbnailImage and poll while async thumb is still generating. */
export function shouldRetryThumbnailWhileEmpty(extension: string, hasThumbnail: boolean): boolean {
  return isDeferredThumbnailExtension(extension) && !hasThumbnail
}

/** Grid should try ThumbnailImage instead of a static placeholder. */
export function shouldRenderThumbnailSlot(extension: string, hasThumbnail: boolean): boolean {
  const caps = resolveFormatCapabilities(extension)
  if (caps.importPipeline === 'image' || caps.importPipeline === 'video' || caps.importPipeline === 'font') {
    return true
  }
  if (hasThumbnail) return true
  return caps.asyncThumbnail !== null
}

export function isFontPreviewExtension(extension: string): boolean {
  return FONT_EXTENSIONS.has(`.${normalizeExtNoDot(extension)}`)
}

export function canPreviewMarkdown(extension: string): boolean {
  return isMarkdownExtension(extension)
}

/** 主色/调色板分析（image、video）。 */
export function supportsColorAnalysis(extension: string): boolean {
  const pipeline = resolveFormatCapabilities(extension).importPipeline
  return pipeline === 'image' || pipeline === 'video'
}

/** 缩略图 object-fit：字体用 contain。 */
export function usesContainThumbnailFit(extension: string): boolean {
  return resolveFormatCapabilities(extension).importPipeline === 'font'
}

/** 文件夹封面：图片或有缩略图的资产。 */
export function canUseAssetAsFolderCover(extension: string, hasThumbnail: boolean): boolean {
  return resolveFormatCapabilities(extension).importPipeline === 'image' || hasThumbnail
}

export type CanvasFlowKind = 'base_image' | 'base_video' | 'base_audio' | 'base_text'

/** AI Canvas 拖入素材时的节点类型映射。 */
export function resolveCanvasFlowType(extension: string): CanvasFlowKind | null {
  switch (resolveFormatCapabilities(extension).importPipeline) {
    case 'image':
      return 'base_image'
    case 'video':
      return 'base_video'
    case 'audio':
      return 'base_audio'
    case 'font':
      return 'base_text'
    default:
      return null
  }
}

/** 瀑布流无尺寸时的默认宽高比。 */
export function defaultLayoutAspectRatio(extension: string): number {
  const caps = resolveFormatCapabilities(extension)
  switch (caps.importPipeline) {
    case 'video':
      return 16 / 9
    case 'font':
      return 1
    case 'audio':
      return 1.2
    default:
      if (caps.defaultFileType === 'document') return 3 / 4
      return 1
  }
}

/** SVG 缩略图路径用于色彩分析时的兜底读取。 */
export function needsSvgThumbForColorAnalysis(extension: string): boolean {
  return resolveFormatCapabilities(extension).imagePipeline === 'svg'
}
