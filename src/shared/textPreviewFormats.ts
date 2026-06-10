/** 文本预览缩略图扩展名 — 配置见 `assetFormatCatalog.ts` TEXT_PREVIEW_THUMB_FORMATS */

export { TEXT_PREVIEW_EXTENSIONS, isTextPreviewExtension } from './assetFormatRegistry'

export interface TextPreviewRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface TextPreviewRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: TextPreviewRegenerateFailure[]
}
