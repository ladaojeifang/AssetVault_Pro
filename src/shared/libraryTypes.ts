/** Portable library bundle mode (manifest.libraryMode). */
export type LibraryMode = 'archive' | 'catalog'

/** Per-asset storage: copy inside library vs external reference. */
export type StorageMode = 'local' | 'referenced'

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
