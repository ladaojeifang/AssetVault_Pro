/** DCC 内嵌缩略图 — 配置见 `assetFormatCatalog.ts` MODEL3D_EMBEDDED_THUMB_FORMATS */

export {
  MODEL3D_EMBEDDED_THUMB_EXTENSIONS,
  parseEmbeddedDccFormat,
  isEmbeddedDccThumbExtension
} from './assetFormatRegistry'

export type { EmbeddedDccFormat } from './assetFormatRegistry'

export interface EmbeddedDccRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface EmbeddedDccRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: EmbeddedDccRegenerateFailure[]
}
