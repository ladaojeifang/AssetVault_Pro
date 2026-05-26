import type { getDatabase } from '../db'
import { tags, assetTags, assetsSearch, assets } from '../db/schema'
import { eq } from 'drizzle-orm'

type Database = ReturnType<typeof getDatabase>

export async function rebuildAssetSearchText(database: Database, assetId: string): Promise<void> {
  const asset = await database
    .select({ filename: assets.filename, originalName: assets.originalName })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get()
  if (!asset) return

  const tagRows = await database
    .select({ name: tags.name })
    .from(tags)
    .innerJoin(assetTags, eq(assetTags.tagId, tags.id))
    .where(eq(assetTags.assetId, assetId))
    .all()

  const tagPart = tagRows.map((t) => t.name).join(' ')
  const searchText = `${asset.filename} ${asset.originalName}${tagPart ? ` ${tagPart}` : ''}`.trim()

  await database.update(assetsSearch).set({ searchText }).where(eq(assetsSearch.assetId, assetId))
}

export async function rebuildSearchTextForTag(database: Database, tagId: string): Promise<void> {
  const links = await database
    .select({ assetId: assetTags.assetId })
    .from(assetTags)
    .where(eq(assetTags.tagId, tagId))
    .all()
  for (const { assetId } of links) {
    await rebuildAssetSearchText(database, assetId)
  }
}
