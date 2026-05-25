// Shared types between main, preload, and renderer

import type { ColorBucket } from './colorBucket'
import type { DatePreset, SizePreset } from './assetFilters'
import type { LocalizationState, StorageMode } from './libraryTypes'

export type FileType = 'image' | 'video' | 'audio' | 'font' | 'design' | 'document' | '3d' | 'code' | 'other'

export interface FolderItem {
  id: string
  name: string
  parentId: string | null
  path: string
  level: number
  assetCount: number
  /** Sidebar accent (hex) */
  color?: string
  /** Optional emoji / icon label */
  icon?: string | null
  createdAt: Date
  updatedAt: Date
  children?: FolderItem[]
}

export interface AssetItem {
  id: string
  filename: string
  originalName: string
  extension: string
  mimeType: string
  fileType: FileType
  folderId: string | null
  filePath: string
  storageMode?: StorageMode
  localizationState?: LocalizationState
  sourceMissingAt?: Date | null
  /** True when referenced asset file is not on disk */
  sourceMissing?: boolean
  /** Absolute path for shell / file:// URLs; set by main when using portable library. */
  resolvedFilePath?: string
  resolvedThumbnailPath?: string | null
  fileSize: number
  /** SHA-256 hex of file content */
  contentHash?: string | null
  contentHashComputedAt?: Date | null
  width?: number | null
  height?: number | null
  dominantColor?: string | null
  /** Hue family for filter bar (computed from dominantColor). */
  colorBucket?: string | null
  colors?: string | null
  duration?: number | null
  thumbnailPath?: string | null
  hasThumbnail: boolean
  metadata?: string | null
  /** User notes / remarks */
  notes?: string | null
  viewCount: number
  accessCount: number
  fileCreatedAt?: Date | null
  fileModifiedAt?: Date | null
  importedAt: Date
  updatedAt: Date
  /** Tag ids from server when listing assets */
  tagIds?: string[]
  /** Logical folder ids (multi-assign) */
  folderIds?: string[]
  tags?: TagItem[]
}

export interface TagItem {
  id: string
  name: string
  color: string
  description?: string | null
  usageCount: number
  createdAt: Date
}

export interface QueryParams {
  /** 0-based row offset for infinite scroll. If omitted, `page` is used. */
  offset?: number
  page?: number
  pageSize?: number
  search?: string
  folderId?: string
  fileType?: FileType
  tags?: string[]
  colorBucket?: ColorBucket
  sizePreset?: SizePreset
  /** Min file size in MB (mutually exclusive with sizePreset in UI). */
  minFileSizeMb?: number
  maxFileSizeMb?: number
  datePreset?: DatePreset
  sortBy?: 'importedAt' | 'filename' | 'fileSize' | 'fileType' | 'extension' | 'dominantColor' | 'viewCount' | 'random'
  sortOrder?: 'asc' | 'desc'
}

export interface QueryResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ImportProgress {
  current: number
  total: number
  filename: string
  status: 'processing' | 'done' | 'error'
}

export type ViewMode = 'grid' | 'list'
export type SortField =
  | 'importedAt'
  | 'filename'
  | 'fileSize'
  | 'fileType'
  | 'extension'
  | 'dominantColor'
  | 'viewCount'
  | 'random'

// Window API augmentation for TypeScript
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on(channel: string, func: (...args: unknown[]) => void): void
        once(channel: string, func: (...args: unknown[]) => void): void
        send(channel: string, ...args: unknown[]): void
        invoke(channel: string, ...args: unknown[]): Promise<unknown>
        removeAllListeners(channel: string): void
      }
      process: NodeJS.Process
    }
    assetVaultAPI: import('../preload/index').AssetVaultAPI
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
