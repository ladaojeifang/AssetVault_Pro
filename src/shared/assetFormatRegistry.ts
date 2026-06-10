/**
 * 由 `assetFormatCatalog.ts` 构建扩展名索引与查询 API。
 * 业务代码请用本模块的函数 / 导出 Set，避免再散落硬编码列表。
 */

import type { FileType } from './types'
import {
  IMAGE_FORMAT_GROUPS,
  VIDEO_FORMATS,
  AUDIO_FORMATS,
  FONT_FORMATS,
  DESIGN_FORMATS,
  DOCUMENT_FORMATS,
  MODEL3D_PREVIEW_FORMATS,
  MODEL3D_IMPORT_ONLY_FORMATS,
  MODEL3D_EMBEDDED_THUMB_FORMATS,
  CODE_FORMATS,
  MARKDOWN_PREVIEW_FORMATS,
  TEXT_PREVIEW_THUMB_FORMATS,
  FOLDER_ICON_FORMATS,
  CUSTOM_THUMB_PICKER_FORMATS,
  FORMAT_ICON_OVERRIDE_FORMATS,
  ARTICLE_BUNDLE_FORMATS,
  FULL_PAGE_STRIP_FORMATS,
  SIDEBAR_IMAGE_PICKER_FORMATS,
  MIME_BY_EXT,
  EXT_BY_MIME,
  MAX_SVG_RASTER_BYTES,
  FALLBACK_MIMES_BY_FILE_TYPE
} from './assetFormatCatalog'

export { MAX_SVG_RASTER_BYTES } from './assetFormatCatalog'

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeExtNoDot(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase().trim()
}

export function normalizeExtWithDot(ext: string): string {
  const bare = normalizeExtNoDot(ext)
  return bare ? `.${bare}` : ''
}

function extFromPath(filePath: string): string {
  const i = filePath.lastIndexOf('.')
  if (i < 0) return ''
  return filePath.slice(i).toLowerCase()
}

function toDotSet(items: readonly string[]): Set<string> {
  return new Set(items.map((e) => `.${normalizeExtNoDot(e)}`))
}

function flattenImageGroups(): string[] {
  const out: string[] = []
  for (const group of Object.values(IMAGE_FORMAT_GROUPS)) {
    for (const e of group) out.push(e)
  }
  return out
}

// ---------------------------------------------------------------------------
// Built extension sets (leading dot)
// ---------------------------------------------------------------------------

export const IMAGE_EXTENSIONS = toDotSet(flattenImageGroups())
export const VIDEO_EXTENSIONS = toDotSet(VIDEO_FORMATS)
export const AUDIO_EXTENSIONS = toDotSet(AUDIO_FORMATS)
export const FONT_EXTENSIONS = toDotSet(FONT_FORMATS)
export const DESIGN_EXTENSIONS = toDotSet(DESIGN_FORMATS)
export const DOCUMENT_EXTENSIONS = toDotSet(DOCUMENT_FORMATS)
export const CODE_EXTENSIONS = toDotSet(CODE_FORMATS)

export const MODEL3D_PREVIEW_EXTENSIONS = toDotSet(MODEL3D_PREVIEW_FORMATS)
export const MODEL3D_IMPORT_ONLY_EXTENSIONS = toDotSet(MODEL3D_IMPORT_ONLY_FORMATS)
export const MODEL3D_ALL_EXTENSIONS = new Set([
  ...MODEL3D_PREVIEW_EXTENSIONS,
  ...MODEL3D_IMPORT_ONLY_EXTENSIONS
])
export const MODEL3D_EMBEDDED_THUMB_EXTENSIONS = toDotSet(MODEL3D_EMBEDDED_THUMB_FORMATS)

export const FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS = toDotSet(IMAGE_FORMAT_GROUPS.ffmpegRaster)

export const MARKDOWN_EXTENSIONS = new Set(
  MARKDOWN_PREVIEW_FORMATS.map((e) => normalizeExtNoDot(e))
)
export const TEXT_PREVIEW_EXTENSIONS = toDotSet(TEXT_PREVIEW_THUMB_FORMATS)

export const FOLDER_ICON_EXTENSIONS = toDotSet(FOLDER_ICON_FORMATS)
export const CUSTOM_THUMB_PICKER_EXTENSIONS = toDotSet(CUSTOM_THUMB_PICKER_FORMATS)
export const FORMAT_ICON_OVERRIDE_EXTENSIONS = toDotSet(FORMAT_ICON_OVERRIDE_FORMATS)
export const ARTICLE_BUNDLE_EXTENSIONS = toDotSet(ARTICLE_BUNDLE_FORMATS)
export const FULL_PAGE_STRIP_EXTENSIONS = toDotSet(FULL_PAGE_STRIP_FORMATS)

const _all = new Set<string>()
for (const s of [
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  FONT_EXTENSIONS,
  DESIGN_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  MODEL3D_ALL_EXTENSIONS,
  CODE_EXTENSIONS
]) {
  for (const e of s) _all.add(e)
}

export const ALL_SUPPORTED_IMPORT_EXTENSIONS: ReadonlySet<string> = _all

/** 扩展名 → file_type */
const _extToFileType = new Map<string, FileType>()

function registerFileType(exts: readonly string[] | Set<string>, fileType: FileType): void {
  for (const e of exts) {
    const dot = normalizeExtWithDot(typeof e === 'string' ? e : e)
    if (dot) _extToFileType.set(dot, fileType)
  }
}

registerFileType(flattenImageGroups(), 'image')
registerFileType(VIDEO_FORMATS, 'video')
registerFileType(AUDIO_FORMATS, 'audio')
registerFileType(FONT_FORMATS, 'font')
registerFileType(DESIGN_FORMATS, 'design')
registerFileType(DOCUMENT_FORMATS, 'document')
registerFileType([...MODEL3D_PREVIEW_FORMATS, ...MODEL3D_IMPORT_ONLY_FORMATS], '3d')
registerFileType(CODE_FORMATS, 'code')

/** MIME → file_type（catalog MIME_BY_EXT + FALLBACK_MIMES_BY_FILE_TYPE） */
const _mimeToFileType = new Map<string, FileType>()

for (const [bare, mime] of Object.entries(MIME_BY_EXT)) {
  const ft = _extToFileType.get(normalizeExtWithDot(bare))
  if (ft) _mimeToFileType.set(mime.toLowerCase(), ft)
}

for (const [fileType, mimes] of Object.entries(FALLBACK_MIMES_BY_FILE_TYPE)) {
  if (!mimes) continue
  for (const mime of mimes) {
    _mimeToFileType.set(mime.toLowerCase(), fileType as FileType)
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getFileTypeFromExtension(ext: string): FileType | null {
  const dot = normalizeExtWithDot(ext)
  return _extToFileType.get(dot) ?? null
}

export function isSupportedImportExtension(ext: string): boolean {
  return ALL_SUPPORTED_IMPORT_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function getMimeForExtension(ext: string): string | null {
  const bare = normalizeExtNoDot(ext)
  return MIME_BY_EXT[bare] ?? null
}

/** Classify by MIME when extension is missing or untrusted. */
export function getFileTypeFromMime(mimeType: string): FileType | null {
  const mt = mimeType.toLowerCase().trim()
  return _mimeToFileType.get(mt) ?? null
}

export function mimeTypesForFileType(fileType: FileType): ReadonlySet<string> {
  const out = new Set<string>()
  for (const [mime, ft] of _mimeToFileType) {
    if (ft === fileType) out.add(mime)
  }
  return out
}

export function extensionFromMime(mime: string): string | null {
  const mt = mime.toLowerCase().trim()
  return EXT_BY_MIME[mt] ?? null
}

/** Electron `showOpenDialog` 用无点扩展名 */
export function extensionsForDialog(filter: 'all' | 'folderIcon' | 'customThumb' | 'sidebarImage'): string[] {
  const set =
    filter === 'all'
      ? ALL_SUPPORTED_IMPORT_EXTENSIONS
      : filter === 'folderIcon'
        ? FOLDER_ICON_EXTENSIONS
        : filter === 'customThumb'
          ? CUSTOM_THUMB_PICKER_EXTENSIONS
          : toDotSet(SIDEBAR_IMAGE_PICKER_FORMATS)
  return [...set].map((e) => e.slice(1))
}

export function supportedExtensionsForDialog(): string[] {
  return extensionsForDialog('all')
}

export function isExtensionInImageGroup(
  ext: string,
  group: keyof typeof IMAGE_FORMAT_GROUPS
): boolean {
  const bare = normalizeExtNoDot(ext)
  return (IMAGE_FORMAT_GROUPS[group] as readonly string[]).includes(bare)
}

export function isFolderIconExtension(ext: string): boolean {
  return FOLDER_ICON_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isFormatIconOverrideSourceExtension(ext: string): boolean {
  return FORMAT_ICON_OVERRIDE_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isArticleBundleExtension(filePath: string): boolean {
  return ARTICLE_BUNDLE_EXTENSIONS.has(normalizeExtWithDot(extFromPath(filePath)))
}

export function isFullPageStripExtension(ext: string): boolean {
  return FULL_PAGE_STRIP_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isFfmpegStillRasterImageExtension(ext: string): boolean {
  return FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isFfmpegStillRasterImagePath(filePath: string): boolean {
  return isFfmpegStillRasterImageExtension(extFromPath(filePath))
}

export function isSvgExtension(ext: string): boolean {
  return isExtensionInImageGroup(ext, 'svg')
}

export function isSvgFilePath(filePath: string): boolean {
  const i = filePath.lastIndexOf('.')
  if (i < 0) return false
  return isSvgExtension(filePath.slice(i))
}

export function isSvgOverRasterLimit(fileSizeBytes: number | null | undefined): boolean {
  return typeof fileSizeBytes === 'number' && fileSizeBytes > MAX_SVG_RASTER_BYTES
}

export function isExrExtension(ext: string): boolean {
  return isExtensionInImageGroup(ext, 'exr')
}

export function isExrFilePath(filePath: string): boolean {
  const i = filePath.lastIndexOf('.')
  if (i < 0) return false
  return isExrExtension(filePath.slice(i))
}

export function isMarkdownExtension(extension: string): boolean {
  return MARKDOWN_EXTENSIONS.has(normalizeExtNoDot(extension))
}

export function isTextPreviewExtension(ext: string): boolean {
  return TEXT_PREVIEW_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isModel3dAssetExtension(ext: string): boolean {
  return MODEL3D_ALL_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isModel3dPreviewExtension(ext: string): boolean {
  return MODEL3D_PREVIEW_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export function isEmbeddedDccThumbExtension(ext: string): boolean {
  return MODEL3D_EMBEDDED_THUMB_EXTENSIONS.has(normalizeExtWithDot(ext))
}

export type Model3dFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'ply' | 'fbx'

export const MODEL3D_ANIMATION_FORMATS = new Set<Model3dFormat>(['glb', 'gltf', 'fbx'])

export function parseModel3dFormat(ext: string): Model3dFormat | null {
  const e = normalizeExtNoDot(ext)
  if (e === 'glb' || e === 'gltf' || e === 'obj' || e === 'stl' || e === 'ply' || e === 'fbx') {
    return e
  }
  return null
}

export function isModel3dAnimationCapableFormat(ext: string): boolean {
  const f = parseModel3dFormat(ext)
  return f !== null && MODEL3D_ANIMATION_FORMATS.has(f)
}

export type EmbeddedDccFormat = 'c4d' | 'max' | 'blend'

export function parseEmbeddedDccFormat(ext: string): EmbeddedDccFormat | null {
  const e = normalizeExtNoDot(ext)
  if (e === 'c4d' || e === 'max' || e === 'blend') return e
  return null
}

/** 所有在 catalog 中配置了 MIME 的扩展（带点），供 model 协议等使用 */
export function mimeMapForKnownExtensions(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [bare, mime] of Object.entries(MIME_BY_EXT)) {
    out[`.${bare}`] = mime
  }
  return out
}
