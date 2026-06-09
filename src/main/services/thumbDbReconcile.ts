import { eq } from 'drizzle-orm'
import { existsSync } from 'fs'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { itemThumbRelative, resolveLibraryPath } from './libraryBundle'
import { syncAssetSidecarFromDb } from './assetSidecar'

type Database = ReturnType<typeof getDatabase>

/** Align has_thumbnail / thumbnail_path with thumb.webp on disk. */
export async function reconcileThumbnailDbWithDisk(
  database: Database,
  assetId: string
): Promise<{ hasThumb: boolean; relPath: string | null }> {
  const relThumb = itemThumbRelative(assetId)
  const absThumb = resolveLibraryPath(relThumb)
  const onDisk = existsSync(absThumb)

  const row = await database
    .select({
      hasThumbnail: assets.hasThumbnail,
      thumbnailPath: assets.thumbnailPath
    })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get()

  if (!row) return { hasThumb: false, relPath: null }

  if (onDisk) {
    if (!row.hasThumbnail || row.thumbnailPath !== relThumb) {
      await database
        .update(assets)
        .set({ hasThumbnail: true, thumbnailPath: relThumb, updatedAt: new Date() })
        .where(eq(assets.id, assetId))
      await syncAssetSidecarFromDb(database, assetId)
    }
    return { hasThumb: true, relPath: relThumb }
  }

  if (row.hasThumbnail || row.thumbnailPath) {
    await database
      .update(assets)
      .set({ hasThumbnail: false, thumbnailPath: null, updatedAt: new Date() })
      .where(eq(assets.id, assetId))
    await syncAssetSidecarFromDb(database, assetId)
  }

  return { hasThumb: false, relPath: null }
}
