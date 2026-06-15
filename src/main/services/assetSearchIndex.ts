import type { getDatabase } from '../db'
import { getRawSqlite } from '../db'
import { wrapBetterSqlite } from '../db/rawSqlite'
import { tags, assetTags, categories, assetsSearch, assets } from '../db/schema'
import { eq } from 'drizzle-orm'
import {
  fileTypeFromSystemTypeCategoryId,
  isSystemTypeCategoryId
} from '@/shared/assetTypeRegistry'
import { syncAssetSidecarFromDb } from './assetSidecar'

type Database = ReturnType<typeof getDatabase>

const SEARCH_INDEX_META_KEY = 'search_index_scheme_b'

/** Sidecar + search index — call after asset/tags/folders/notes are stable. */
export async function finalizeAssetRecords(database: Database, assetId: string): Promise<void> {
  await rebuildAssetSearchText(database, assetId)
  await syncAssetSidecarFromDb(database, assetId)
}

async function typeNameForAsset(
  database: Database,
  typeId: string
): Promise<string | null> {
  if (isSystemTypeCategoryId(typeId)) {
    const ft = fileTypeFromSystemTypeCategoryId(typeId)
    return ft ?? null
  }
  const row = await database
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, typeId))
    .get()
  return row?.name ?? null
}

export async function rebuildAssetSearchText(database: Database, assetId: string): Promise<void> {
  const asset = await database
    .select({
      filename: assets.filename,
      originalName: assets.originalName,
      notes: assets.notes,
      sourceUrl: assets.sourceUrl,
      typeId: assets.typeId
    })
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
  const typeName = await typeNameForAsset(database, asset.typeId)
  const typePart = typeName ?? ''

  const notesPart = asset.notes?.trim() ?? ''
  const urlPart = asset.sourceUrl?.trim() ?? ''
  const searchText = `${asset.filename} ${asset.originalName}${tagPart ? ` ${tagPart}` : ''}${typePart ? ` ${typePart}` : ''}${notesPart ? ` ${notesPart}` : ''}${urlPart ? ` ${urlPart}` : ''}`.trim()

  const existing = await database
    .select({ assetId: assetsSearch.assetId })
    .from(assetsSearch)
    .where(eq(assetsSearch.assetId, assetId))
    .get()

  if (existing) {
    await database.update(assetsSearch).set({ searchText }).where(eq(assetsSearch.assetId, assetId))
  } else {
    await database.insert(assetsSearch).values({ assetId, searchText })
  }
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

export async function rebuildSearchTextForCategory(
  database: Database,
  categoryId: string
): Promise<void> {
  const links = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.typeId, categoryId))
    .all()
  for (const { id: assetId } of links) {
    await rebuildAssetSearchText(database, assetId)
  }
}

export async function rebuildAllAssetSearchText(database: Database): Promise<number> {
  const rows = await database.select({ id: assets.id }).from(assets).all()
  for (let i = 0; i < rows.length; i++) {
    await rebuildAssetSearchText(database, rows[i]!.id)
    if (i > 0 && i % 50 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  }
  return rows.length
}

/** One-time backfill after scheme-B trigger migration (app layer owns search index). */
export async function ensureAssetSearchIndexBackfill(): Promise<void> {
  const sqlite = wrapBetterSqlite(getRawSqlite())
  const done = sqlite.getScalarInt(
    `SELECT value FROM _av_schema_meta WHERE key = '${SEARCH_INDEX_META_KEY}' LIMIT 1`
  )
  if (done === 1) return

  const database = (await import('../db')).getDatabase()
  const count = await rebuildAllAssetSearchText(database)
  sqlite.run(
    `INSERT OR REPLACE INTO _av_schema_meta (key, value) VALUES ('${SEARCH_INDEX_META_KEY}', 1)`
  )
  console.log(`[DB] Rebuilt assets_search for ${count} asset(s) (scheme B)`)
}
