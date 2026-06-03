/** Content hash algorithm stored in DB and meta.json */
export const CONTENT_HASH_ALGO = 'sha256' as const

export type DuplicatePolicy = 'ask' | 'use_existing' | 'import_copy'

export type DuplicateResolution = 'use_existing' | 'import_copy' | 'cancel'

export interface DuplicateImportAnswer {
  resolution: DuplicateResolution
  /** Apply same choice to remaining files in this import batch */
  applyToAll?: boolean
}

export interface DuplicateImportPromptPayload {
  requestId: string
  sourcePath: string
  sourceName: string
  contentHash: string
  fileSize: number
  existing: {
    id: string
    originalName: string
    filename: string
    importedAt: string
    folderNames: string[]
  }
}

export interface ImportAssetOptions {
  targetFolderId?: string
  duplicatePolicy?: DuplicatePolicy
  /** When set, use this UUID for `items/{id}/` instead of generating a new one. */
  presetAssetId?: string
  /** Primary file is already at the pack path under the library; do not copy/hardlink again. */
  skipCopyIntoPack?: boolean
}

export interface ContentHashScanProgress {
  current: number
  total: number
  assetId: string
  status: 'processing' | 'done' | 'skipped' | 'error'
}

export interface ContentHashScanResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
}
