/**
 * 资产格式统一配置（单一数据源）
 *
 * 新增/调整扩展名请优先只改本文件，再由 `assetFormatRegistry.ts` 生成各处的 Set / 判断函数。
 * 扩展名一律为**无点、小写**（如 `jpg`）；注册表会规范为 `.jpg`。
 */

import type { FileType } from './types'

// ---------------------------------------------------------------------------
// 按 file_type 分类
// ---------------------------------------------------------------------------

/** 图片：子类用于缩略图/预览管线分支（svg、exr、ffmpeg 栅格等） */
export const IMAGE_FORMAT_GROUPS = {
  /** @napi-rs/image 直解的常见位图 */
  raster: [
    'jpg',
    'jpeg',
    'jfif',
    'png',
    'gif',
    'webp',
    'bmp',
    'ico',
    'tiff',
    'tif',
    'heic',
    'heif',
    'avif'
  ],
  /** 矢量：独立全屏预览 + 栅格缩略图 */
  svg: ['svg'],
  /** OpenEXR：HDR 预览与专用缩略图 */
  exr: ['exr'],
  /** ffmpeg 静帧解码后再走 napi */
  ffmpegRaster: [
    'tga',
    'hdr',
    'qoi',
    'apng',
    'jp2',
    'j2k',
    'jpc',
    'j2c',
    'jls',
    'dpx',
    'pcx',
    'rgb',
    'rgba',
    'bw',
    'sun',
    'ras',
    'xbm',
    'xpm',
    'fits',
    'fit',
    'fts'
  ],
  /** @napi-rs/image 支持的额外栅格 */
  napiRaster: ['pbm', 'pgm', 'ppm', 'pam', 'dds', 'ff'],
  /** 相机 RAW / DNG */
  cameraRaw: ['cr2', 'nef', 'arw', 'orf', 'raf', 'dng', 'rw2', 'raw']
} as const

export const VIDEO_FORMATS = [
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'flv',
  'wmv',
  'm4v',
  '3gp',
  'mpeg',
  'mpg',
  'm2ts',
  'mts'
] as const

export const AUDIO_FORMATS = [
  'mp3',
  'wav',
  'flac',
  'aac',
  'ogg',
  'oga',
  'wma',
  'm4a',
  'aiff',
  'aif',
  'ape',
  'opus'
] as const

export const FONT_FORMATS = ['ttf', 'otf', 'woff', 'woff2', 'eot', 'ttc'] as const

export const DESIGN_FORMATS = [
  'psd',
  'ai',
  'sketch',
  'fig',
  'xd',
  'pdf',
  'eps',
  'indd',
  'afdesign'
] as const

export const DOCUMENT_FORMATS = [
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'md',
  'txt',
  'csv',
  'rtf',
  'odt',
  'ods',
  'odp'
] as const

/** 可应用内 3D 预览 + 自动缩略图 */
export const MODEL3D_PREVIEW_FORMATS = ['glb', 'gltf', 'obj', 'stl', 'ply', 'fbx'] as const

/** 仅入库 file_type=3d，无预览 */
export const MODEL3D_IMPORT_ONLY_FORMATS = [
  'abc',
  'ma',
  'mb',
  'max',
  'c4d',
  'hip',
  'usd',
  'usda',
  'usdz',
  'blend'
] as const

/** DCC 内嵌预览图提取（非 Babylon 渲染） */
export const MODEL3D_EMBEDDED_THUMB_FORMATS = ['c4d', 'max', 'blend'] as const

export const CODE_FORMATS = [
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'py',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'json',
  'yaml',
  'yml',
  'vue',
  'svelte',
  'rs',
  'go',
  'java',
  'kt',
  'swift',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'php',
  'rb',
  'sh',
  'ps1',
  'bat',
  'cmd',
  'xml'
] as const

// ---------------------------------------------------------------------------
// 跨类型用途（对话框过滤、资料包白名单等）
// ---------------------------------------------------------------------------

/** Markdown 全屏预览（扩展名可多于 document 里的 md） */
export const MARKDOWN_PREVIEW_FORMATS = ['md', 'markdown', 'mdown', 'mkd'] as const

/** 纸张风格文本缩略图 */
export const TEXT_PREVIEW_THUMB_FORMATS = ['json', 'md', 'txt'] as const

/** 文件夹自定义图标可选格式 */
export const FOLDER_ICON_FORMATS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'gif',
  'webp',
  'ico',
  'svg'
] as const

/** 自定义缩略图快捷键可选图片 */
export const CUSTOM_THUMB_PICKER_FORMATS = [
  'jpg',
  'jpeg',
  'jfif',
  'png',
  'webp',
  'gif',
  'bmp',
  'avif',
  'exr'
] as const

/** 设置页格式图标覆盖可选源图 */
export const FORMAT_ICON_OVERRIDE_FORMATS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'webp',
  'gif',
  'svg',
  'bmp',
  'ico'
] as const

/** 文章资料包会话允许写入的扩展名 */
export const ARTICLE_BUNDLE_FORMATS = [
  'md',
  'json',
  'jpg',
  'jpeg',
  'jfif',
  'png',
  'webp',
  'gif',
  'svg',
  'avif',
  'mp4',
  'webm',
  'mov',
  'm4v'
] as const

/** 整页截图条带 */
export const FULL_PAGE_STRIP_FORMATS = ['jpg', 'jpeg', 'png'] as const

/** 侧栏文件夹图标文件对话框 */
export const SIDEBAR_IMAGE_PICKER_FORMATS = FOLDER_ICON_FORMATS

// ---------------------------------------------------------------------------
// MIME（data URL 导入、缩略图 data URL、Markdown 内嵌图等）
// ---------------------------------------------------------------------------

/** 主 MIME；键为无点扩展名 */
export const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  exr: 'image/x-exr',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  obj: 'text/plain',
  mtl: 'text/plain',
  stl: 'model/stl',
  fbx: 'application/octet-stream',
  ply: 'application/octet-stream',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttc: 'font/collection',
  eot: 'application/vnd.ms-fontobject'
}

/** data URL / Content-Type → 首选扩展名（带点） */
export const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/jfif': '.jfif',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg'
}

/** SVG 栅格化大小上限 */
export const MAX_SVG_RASTER_BYTES = 5 * 1024 * 1024

// ---------------------------------------------------------------------------
// MIME 兜底（扩展名缺失或 application/octet-stream 时）
// ---------------------------------------------------------------------------

/**
 * 无稳定扩展名映射时的 MIME → file_type 兜底。
 * 主路径仍优先扩展名（见 assetFormatRegistry.getFileTypeFromExtension）。
 */
export const FALLBACK_MIMES_BY_FILE_TYPE: Partial<Record<FileType, readonly string[]>> = {
  image: [
    'image/vnd.microsoft.icon',
    'image/x-adobe-dng',
    'image/x-canon-cr2',
    'image/x-nikon-nef',
    'image/x-sony-arw'
  ],
  video: [
    'video/x-msvideo',
    'video/x-matroska',
    'video/x-flv',
    'video/x-ms-wmv',
    'video/mpeg',
    'video/3gpp'
  ],
  audio: ['audio/mpeg', 'audio/x-ms-wma', 'audio/aiff', 'audio/x-aiff', 'audio/opus']
}
