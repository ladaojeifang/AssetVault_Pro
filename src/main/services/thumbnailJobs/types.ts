import type { getDatabase } from '../../db'
import type { ThumbnailGenerateResult } from '../ThumbnailService'

export type Database = ReturnType<typeof getDatabase>

export type AssetThumbRow = {
  id: string
  filename: string
  extension: string
  fileType: string
  filePath: string | null
  hasThumbnail: boolean
  thumbnailPath: string | null
}

export type ThumbJobProgress = {
  current: number
  total: number
  assetId: string
  status: 'processing' | 'done' | 'error'
}

export type ThumbRegenerateFailure = {
  assetId: string
  filename: string
  reason: string
}

export type ThumbRegenerateResult = {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: ThumbRegenerateFailure[]
}

export type ThumbGenerateOptions = {
  width: number
  height: number
  quality: number
  force: boolean
}

export type ThumbGenerateFn = (
  absFile: string,
  assetId: string,
  extNoDot: string,
  options: ThumbGenerateOptions
) => Promise<ThumbnailGenerateResult | null>

export interface AsyncThumbnailJob {
  id: 'model3d' | 'embedded-dcc' | 'text-preview'
  logTag: string
  matchesAsset: (extNoDot: string) => boolean
  loadRows: (database: Database) => Promise<AssetThumbRow[]>
  /** When false, non-matching rows in loadRows count as skipped (3D preview job). */
  rowsAreCandidatesOnly: boolean
  generate: ThumbGenerateFn
  maxAttempts: number
  retryDelayMs: (attempt: number) => number
  skipMarkReason: string
  regenerateFailReason: string
  extractColor?: boolean
  beforeBatch?: () => Promise<void>
  beforeGenerate?: () => Promise<void>
}
