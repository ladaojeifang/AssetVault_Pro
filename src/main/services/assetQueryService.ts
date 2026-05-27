import { eq, and, inArray, desc, asc, sql, count, type SQL } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import type { AssetItem, QueryParams, QueryResult } from '@/shared/types'
import { buildSearchCondition, tokenizeSearchQuery } from './assetSearch'
import {
  buildColorBucketCondition,
  buildDatePresetCondition,
  buildFileSizeMbCondition,
  buildSizePresetCondition
} from './assetQueryFilters'
import { attachResolvedPaths, getAssetFolderIds, getAssetTagIds } from './assetRowHelpers'
import { removeItemPack } from './libraryBundle'

export async function queryAssets(params: QueryParams): Promise<QueryResult<AssetItem>> {
  const database = getDatabase()
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 80))
  const offset =
    typeof params.offset === 'number' && params.offset >= 0
      ? params.offset
      : ((params.page ?? 1) - 1) * pageSize

  const conditions: SQL[] = []

  const searchTokens = tokenizeSearchQuery(params.search ?? '')
  const searchCond = buildSearchCondition(searchTokens)
  if (searchCond) conditions.push(searchCond)

  if (params.colorBucket) {
    conditions.push(buildColorBucketCondition(params.colorBucket))
  }

  if (params.sizePreset) {
    conditions.push(buildSizePresetCondition(params.sizePreset))
  } else {
    const sizeMbCond = buildFileSizeMbCondition(params.minFileSizeMb, params.maxFileSizeMb)
    if (sizeMbCond) conditions.push(sizeMbCond)
  }

  if (params.datePreset) {
    conditions.push(buildDatePresetCondition(params.datePreset))
  }

  if (params.folderId) {
    conditions.push(
      sql`exists (select 1 from asset_folders af where af.asset_id = ${assets.id} and af.folder_id = ${params.folderId})`
    )
  }

  if (params.fileType) {
    conditions.push(eq(assets.fileType, params.fileType))
  }

  if (params.tags?.length) {
    for (const tagId of params.tags) {
      conditions.push(
        sql`exists (select 1 from asset_tags at where at.asset_id = ${assets.id} and at.tag_id = ${tagId})`
      )
    }
  }

  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined

  const totalResult = whereExpr
    ? await database.select({ count: count() }).from(assets).where(whereExpr).get()
    : await database.select({ count: count() }).from(assets).get()
  const total = totalResult?.count ?? 0

  let orderBy
  switch (params.sortBy) {
    case 'filename':
      orderBy = params.sortOrder === 'asc' ? asc(assets.filename) : desc(assets.filename)
      break
    case 'fileSize':
      orderBy = params.sortOrder === 'asc' ? asc(assets.fileSize) : desc(assets.fileSize)
      break
    case 'fileType':
      orderBy = params.sortOrder === 'asc' ? asc(assets.fileType) : desc(assets.fileType)
      break
    case 'extension':
      orderBy = params.sortOrder === 'asc' ? asc(assets.extension) : desc(assets.extension)
      break
    case 'viewCount':
      orderBy = desc(assets.viewCount)
      break
    case 'dominantColor':
      orderBy =
        params.sortOrder === 'asc' ? asc(assets.dominantColor) : desc(assets.dominantColor)
      break
    case 'random':
      orderBy = sql`RANDOM()`
      break
    case 'importedAt':
    default:
      orderBy = desc(assets.importedAt)
      break
  }

  const items = whereExpr
    ? await database.select().from(assets).where(whereExpr).orderBy(orderBy).limit(pageSize).offset(offset).all()
    : await database.select().from(assets).orderBy(orderBy).limit(pageSize).offset(offset).all()

  const itemsWithTags = await Promise.all(
    items.map(async (item) => {
      const [tagIds, folderIds] = await Promise.all([
        getAssetTagIds(item.id),
        getAssetFolderIds(item.id)
      ])
      return { ...attachResolvedPaths(item), tagIds, folderIds }
    })
  )

  const pageComputed = Math.floor(offset / pageSize) + 1

  return {
    items: itemsWithTags,
    total,
    page: pageComputed,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export async function getAssetById(
  id: string,
  options?: { incrementViewCount?: boolean }
): Promise<AssetItem | null> {
  const database = getDatabase()
  const item = await database.select().from(assets).where(eq(assets.id, id)).get()

  if (!item) return null

  if (options?.incrementViewCount !== false) {
    await database
      .update(assets)
      .set({ viewCount: sql`${assets.viewCount} + 1`, accessCount: sql`${assets.accessCount} + 1` })
      .where(eq(assets.id, id))
  }

  const [tagIds, folderIds] = await Promise.all([getAssetTagIds(id), getAssetFolderIds(id)])
  return { ...attachResolvedPaths(item), tagIds, folderIds }
}

export async function deleteAssets(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const database = getDatabase()
  for (const id of ids) {
    removeItemPack(id)
  }
  await database.delete(assets).where(inArray(assets.id, ids))
  return ids.length
}
