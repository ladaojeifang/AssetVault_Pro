import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { resolveExistingThumbnailRelPath } from './thumbnailRead'
import { syncAssetSidecarFromDb } from './assetSidecar'

type Database = ReturnType<typeof getDatabase>

/** Align has_thumbnail / thumbnail_path with on-disk thumbnail files. */
export async function reconcileThumbnailDbWithDisk(
  database: Database,
  assetId: string
): Promise<{ hasThumb: boolean; relPath: string | null }> {
  const row = await database
    .select({
      hasThumbnail: assets.hasThumbnail,
      thumbnailPath: assets.thumbnailPath
    })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get()

  if (!row) return { hasThumb: false, relPath: null }

  const existingRel = resolveExistingThumbnailRelPath(assetId, row.thumbnailPath)
  if (existingRel) {
    if (!row.hasThumbnail || row.thumbnailPath !== existingRel) {
      await database
        .update(assets)
        .set({ hasThumbnail: true, thumbnailPath: existingRel, updatedAt: new Date() })
        .where(eq(assets.id, assetId))
      await syncAssetSidecarFromDb(database, assetId)
    }
    return { hasThumb: true, relPath: existingRel }
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
