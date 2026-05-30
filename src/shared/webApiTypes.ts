import type { LibraryLocalizationManifest, LibraryMode, LibraryModeStats } from './libraryTypes'
import type { FileType, QueryParams } from './types'

export type JSendSuccess<T> = { status: 'success'; data: T }
export type JSendError = { status: 'error'; code: string; message: string }

export type WebApiAssetDto = {
  id: string
  filename: string
  originalName: string
  extension: string
  mimeType: string
  fileType: FileType
  folderId: string | null
  filePath: string
  storageMode?: string
  localizationState?: string
  sourceMissingAt?: string | null
  sourceMissing?: boolean
  resolvedFilePath?: string
  resolvedThumbnailPath?: string | null
  fileSize: number
  contentHash?: string | null
  contentHashComputedAt?: string | null
  width?: number | null
  height?: number | null
  dominantColor?: string | null
  colorBucket?: string | null
  colors?: string | null
  duration?: number | null
  thumbnailPath?: string | null
  hasThumbnail: boolean
  metadata?: string | null
  notes?: string | null
  viewCount: number
  accessCount: number
  fileCreatedAt?: string | null
  fileModifiedAt?: string | null
  importedAt: string
  updatedAt: string
  tagIds?: string[]
  folderIds?: string[]
}

export type WebApiPaged<T> = {
  data: T[]
  total: number
  offset: number
  limit: number
}

export type AppInfoResponse = {
  name: string
  version: string
  apiVersion: 'v1'
  platform: NodeJS.Platform
  packaged: boolean
}

export type LibraryInfoResponse = {
  libraryRoot: string
  dbPath: string
  manifestPath: string
  displayName: string
  libraryMode: LibraryMode
  localization: LibraryLocalizationManifest | null
  stats: LibraryModeStats
}

export type LibraryStateResponse = {
  activeLibraryRoot: string
  recentLibraries: string[]
  libraryDisplayName: string
  libraryMode: LibraryMode
  manifestPath: string
  dbPath: string
}

export type AssetImportRequest = {
  filePath: string
  targetFolderId?: string
  duplicatePolicy?: 'ask' | 'use_existing' | 'import_copy'
}

export type AssetImportResult = {
  assetId?: string
  skipped: boolean
  reason?: string
  existingAssetId?: string
}

export type AssetImportBatchResponse = {
  imported: string[]
  skipped: Array<{ filePath: string; reason: string; existingAssetId?: string }>
  errors: Array<{ filePath: string; message: string }>
}

export type AssetImportFolderResponse = {
  imported: string[]
  totalFiles: number
  errors: Array<{ filePath: string; message: string }>
}

export type AssetImportFromUrlRequest = {
  url: string
  filename?: string
  targetFolderId?: string
  duplicatePolicy?: 'ask' | 'use_existing' | 'import_copy'
  /** Optional HTTP headers for remote download (e.g. Referer for hotlink protection). */
  headers?: Record<string, string>
}

export type AssetImportFromUrlBatchRequest = {
  items: Array<{ url: string; filename?: string; headers?: Record<string, string> }>
  targetFolderId?: string
  duplicatePolicy?: 'ask' | 'use_existing' | 'import_copy'
  headers?: Record<string, string>
}

export type AssetImportFromUrlBatchResponse = {
  imported: string[]
  skipped: Array<{ url: string; reason: string; existingAssetId?: string }>
  errors: Array<{ url: string; message: string }>
}

export type AssetImportFromDataUrlRequest = {
  dataUrl: string
  filename?: string
  targetFolderId?: string
  duplicatePolicy?: 'ask' | 'use_existing' | 'import_copy'
}

export type AssetImportFromDataUrlResult = AssetImportResult

/** HTTP query/body → internal QueryParams */
export type WebApiAssetQueryInput = QueryParams & {
  offset?: number
  limit?: number
}

export type WebApiFolderDto = {
  id: string
  name: string
  parentId: string | null
  path: string
  level: number
  assetCount: number
  color?: string
  icon?: string | null
  createdAt: string
  updatedAt: string
  children?: WebApiFolderDto[]
}

export type WebApiTagDto = {
  id: string
  name: string
  color: string
  description?: string | null
  usageCount: number
  createdAt: string
}
