/** Portable library bundle mode (manifest.libraryMode). */
export type LibraryMode = 'archive' | 'catalog' | 'embedded'

/** Per-asset storage: copy inside library vs external reference vs embedded (file stays in-place). */
export type StorageMode = 'local' | 'referenced' | 'embedded'

export type LocalizationState = 'idle' | 'pending' | 'done' | 'failed'

export type LibraryLocalizationManifest = {
  state: 'idle' | 'running' | 'completed' | 'completed_with_errors'
  startedAt: string | null
  completedAt: string | null
  lastJobId: string | null
}

export interface LibraryManifest {
  formatVersion: string
  appId: string
  libraryId: string
  displayName: string
  libraryMode: LibraryMode
  createdAt: string
  updatedAt: string
  localization?: LibraryLocalizationManifest
}

export interface LibraryModeStats {
  libraryMode: LibraryMode
  referencedCount: number
  localCount: number
  missingSourceCount: number
  pendingLocalizationCount: number
}

export interface LocalizeAssetsResult {
  localized: number
  skipped: number
  failed: number
  errors: Array<{ assetId: string; filename: string; reason: string }>
}

export interface UpgradeLibraryProgress {
  current: number
  total: number
  filename: string
  status: 'processing' | 'done' | 'error'
  bytesCopied?: number
}

export type ImportLibraryPhase = 'validate' | 'tags' | 'folders' | 'assets' | 'finalize'

export interface ImportLibraryProgress {
  phase: ImportLibraryPhase
  current: number
  total: number
  filename: string
  status: 'processing' | 'done' | 'error'
}

export type ImportLibrarySuccess = {
  ok: true
  importMode?: 'archive_to_archive' | 'catalog_to_catalog_same_machine'
  sourceDisplayName: string
  sourceLibraryRoot: string
  assetsAdded: number
  assetsSkippedDuplicate: number
  assetsFailed: number
  foldersCreated: number
  foldersMerged: number
  tagsCreated: number
  tagsMerged: number
  categoriesCreated: number
  categoriesMerged: number
  sourceLibraryTagName: string
  assetsAddedLocal?: number
  assetsAddedReferenced?: number
  assetsLocalizedOnImport?: number
  assetsSkippedDuplicateLocal?: number
  errors: Array<{ sourceAssetId: string; filename: string; reason: string }>
}

export type ImportLibraryFailure = {
  ok: false
  error: string
  code?:
    | 'INVALID_PATH'
    | 'INVALID_SOURCE_MODE'
    | 'SAME_LIBRARY'
    | 'SOURCE_NOT_FOUND'
    | 'SOURCE_DB_ERROR'
    | 'TARGET_NOT_ARCHIVE'
    | 'TARGET_NOT_CATALOG'
    | 'LIBRARY_BUSY'
}

export type ImportLibraryResult = ImportLibrarySuccess | ImportLibraryFailure

export type EmbeddedImportPhase = 'scan' | 'import' | 'finalize'

export interface EmbeddedImportProgress {
  phase: EmbeddedImportPhase
  current: number
  total: number
  filename: string
  status: 'processing' | 'done' | 'error'
}

export type CreateEmbeddedLibraryResult = {
  ok: true
  libraryRoot: string
  assetsAdded: number
  assetsSkippedDuplicate: number
  assetsFailed: number
  errors: Array<{ filename: string; reason: string }>
} | {
  ok: false
  error: string
  code?: 'INVALID_PATH' | 'ALREADY_EMBEDDED' | 'WRONG_MODE' | 'NOT_WRITABLE'
}
