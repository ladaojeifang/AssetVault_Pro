/** 3D 格式 — 配置见 `assetFormatCatalog.ts` MODEL3D_* */

export {
  MODEL3D_PREVIEW_EXTENSIONS,
  MODEL3D_IMPORT_ONLY_EXTENSIONS,
  MODEL3D_ALL_EXTENSIONS,
  MODEL3D_ANIMATION_FORMATS,
  parseModel3dFormat,
  isModel3dAssetExtension,
  isModel3dPreviewExtension,
  isModel3dAnimationCapableFormat
} from './assetFormatRegistry'

export type { Model3dFormat } from './assetFormatRegistry'

export interface ModelAnimationClipInfo {
  name: string
  durationSeconds: number
}

export interface ModelRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface ModelRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: ModelRegenerateFailure[]
}
