import type { AssetItem, FolderItem, TagItem } from '@/shared/types'
import type { JSendSuccess, WebApiAssetDto, WebApiFolderDto, WebApiTagDto } from '@/shared/webApiTypes'

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function serializeAsset(row: AssetItem): WebApiAssetDto {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.originalName,
    extension: row.extension,
    mimeType: row.mimeType,
    fileType: row.fileType,
    folderId: row.folderId,
    filePath: row.filePath,
    storageMode: row.storageMode,
    localizationState: row.localizationState,
    sourceMissingAt: toIso(row.sourceMissingAt),
    sourceMissing: row.sourceMissing,
    resolvedFilePath: row.resolvedFilePath,
    resolvedThumbnailPath: row.resolvedThumbnailPath ?? null,
    fileSize: row.fileSize,
    contentHash: row.contentHash ?? null,
    contentHashComputedAt: toIso(row.contentHashComputedAt),
    width: row.width ?? null,
    height: row.height ?? null,
    dominantColor: row.dominantColor ?? null,
    colorBucket: row.colorBucket ?? null,
    colors: row.colors ?? null,
    duration: row.duration ?? null,
    thumbnailPath: row.thumbnailPath ?? null,
    hasThumbnail: row.hasThumbnail,
    metadata: row.metadata ?? null,
    notes: row.notes ?? null,
    sourceUrl: row.sourceUrl ?? null,
    viewCount: row.viewCount,
    accessCount: row.accessCount,
    fileCreatedAt: toIso(row.fileCreatedAt),
    fileModifiedAt: toIso(row.fileModifiedAt),
    importedAt: toIso(row.importedAt) ?? '',
    updatedAt: toIso(row.updatedAt) ?? '',
    tagIds: row.tagIds,
    folderIds: row.folderIds
  }
}

export function serializeFolder(row: FolderItem): WebApiFolderDto {
  const base = {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    path: row.path,
    level: row.level,
    assetCount: row.assetCount,
    color: row.color,
    icon: row.icon ?? null,
    createdAt: toIso(row.createdAt) ?? '',
    updatedAt: toIso(row.updatedAt) ?? ''
  }
  if (row.children?.length) {
    return { ...base, children: row.children.map(serializeFolder) }
  }
  return base
}

export function serializeTag(row: TagItem): WebApiTagDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description ?? null,
    usageCount: row.usageCount,
    createdAt: toIso(row.createdAt) ?? ''
  }
}

export function jsendSuccess<T>(data: T): JSendSuccess<T> {
  return { status: 'success', data }
}