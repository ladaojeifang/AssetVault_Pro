import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assetTags, assetFolders } from '../db/schema'
import { resolveLibraryPath } from './libraryBundle'
import { resolveAssetContentPath, isAssetSourceMissing } from './assetPathResolver'

export async function getAssetTagIds(assetId: string): Promise<string[]> {
  const database = getDatabase()
  const results = await database
    .select({ tagId: assetTags.tagId })
    .from(assetTags)
    .where(eq(assetTags.assetId, assetId))
    .all()
  return results.map((r) => r.tagId)
}

export async function getAssetFolderIds(assetId: string): Promise<string[]> {
  const database = getDatabase()
  const results = await database
    .select({ folderId: assetFolders.folderId })
    .from(assetFolders)
    .where(eq(assetFolders.assetId, assetId))
    .all()
  return results.map((r) => r.folderId)
}

export function attachResolvedPaths<
  T extends {
    filePath: string
    thumbnailPath?: string | null
    storageMode?: string | null
  }
>(row: T): T & {
  resolvedFilePath: string
  resolvedThumbnailPath: string | null
  sourceMissing: boolean
} {
  return {
    ...row,
    resolvedFilePath: resolveAssetContentPath(row),
    resolvedThumbnailPath: row.thumbnailPath ? resolveLibraryPath(row.thumbnailPath) : null,
    sourceMissing: isAssetSourceMissing(row)
  }
}
