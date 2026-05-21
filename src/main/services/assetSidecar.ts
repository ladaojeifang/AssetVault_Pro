import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets, tags, assetTags, assetFolders } from '../db/schema'
import { getLibraryRoot, itemThumbRelative } from './libraryBundle'
import { CONTENT_HASH_ALGO } from '@/shared/importTypes'

/** Relative path to meta.json for a given asset id */
export function metaJsonRelative(assetId: string): string {
  return `items/${assetId}/meta.json`
}

type Db = ReturnType<typeof getDatabase>

export type SidecarTag = { id: string; name: string }

export function writeAssetSidecarMeta(
  row: {
    id: string
    filename: string
    originalName: string
    extension: string
    mimeType: string
    fileType: string
    folderId: string | null
    filePath: string
    fileSize: number
    width?: number | null
    height?: number | null
    dominantColor?: string | null
    colors?: string | null
    duration?: number | null
    thumbnailPath?: string | null
    hasThumbnail: boolean
    metadata?: string | null
    notes?: string | null
    contentHash?: string | null
    contentHashComputedAt?: Date | null
    fileCreatedAt?: Date | null
    fileModifiedAt?: Date | null
    importedAt: Date
    updatedAt: Date
  },
  tagList: SidecarTag[],
  folderIds: string[] = [],
  libraryRoot?: string
): void {
  const root = libraryRoot ?? getLibraryRoot()
  const dir = join(root, 'items', row.id)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const originalRel = row.filePath.replace(/\\/g, '/')
  const thumbRel =
    row.hasThumbnail && row.thumbnailPath
      ? row.thumbnailPath.replace(/\\/g, '/')
      : row.hasThumbnail
        ? itemThumbRelative(row.id)
        : null

  const ts = (d: Date | null | undefined) =>
    d instanceof Date ? Math.floor(d.getTime() / 1000) : null

  const payload = {
    id: row.id,
    metaVersion: 1,
    originalName: row.originalName,
    filename: row.filename,
    extension: row.extension.replace(/^\./, '').toLowerCase(),
    mimeType: row.mimeType,
    fileType: row.fileType,
    folderId: row.folderId,
    folderIds,
    fileSize: row.fileSize,
    contentHash: row.contentHash
      ? {
          algo: CONTENT_HASH_ALGO,
          value: row.contentHash,
          computedAt: ts(row.contentHashComputedAt)
        }
      : null,
    width: row.width ?? null,
    height: row.height ?? null,
    dominantColor: row.dominantColor ?? null,
    colors: row.colors ?? null,
    duration: row.duration ?? null,
    metadata: row.metadata ?? null,
    notes: row.notes ?? null,
    fileCreatedAt: ts(row.fileCreatedAt),
    fileModifiedAt: ts(row.fileModifiedAt),
    importedAt: ts(row.importedAt),
    updatedAt: ts(row.updatedAt),
    tags: tagList,
    paths: {
      original: originalRel,
      thumb: thumbRel
    }
  }

  writeFileSync(join(dir, 'meta.json'), JSON.stringify(payload, null, 2), 'utf-8')
}

export async function syncAssetSidecarFromDb(database: Db, assetId: string): Promise<void> {
  const root = getLibraryRoot()
  const itemDir = join(root, 'items', assetId)
  if (!existsSync(itemDir)) return

  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) return

  const tagRows = await database
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .innerJoin(assetTags, eq(assetTags.tagId, tags.id))
    .where(eq(assetTags.assetId, assetId))
    .all()

  const folderIdRows = await database
    .select({ id: assetFolders.folderId })
    .from(assetFolders)
    .where(eq(assetFolders.assetId, assetId))
    .all()

  writeAssetSidecarMeta(row, tagRows, folderIdRows.map((r) => r.id))
}
