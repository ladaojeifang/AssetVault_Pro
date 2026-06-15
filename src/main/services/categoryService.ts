import { v4 as uuidv4 } from 'uuid'
import { getDatabase, getRawSqlite } from '../db'
import { categories, assets } from '../db/schema'
import { eq, count, asc, desc, sql, inArray } from 'drizzle-orm'
import type { CategoryItem, FileType } from '@/shared/types'
import { finalizeAssetRecords, rebuildSearchTextForCategory } from './assetSearchIndex'
import {
  buildSystemCategoryItems,
  defaultTypeIdForFileType,
  fileTypeFromSystemTypeCategoryId,
  isSystemTypeCategoryId
} from '@/shared/assetTypeRegistry'

async function refreshUserCategoryUsageCounts(database: ReturnType<typeof getDatabase>): Promise<void> {
  void database
  getRawSqlite().exec(
    `UPDATE categories SET usage_count = COALESCE((SELECT COUNT(*) FROM assets WHERE assets.type_id = categories.id), 0)`
  )
}

export async function listCategories(): Promise<CategoryItem[]> {
  const database = getDatabase()
  const rows = await database
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all()

  const typeIdUsageRows = await database
    .select({ typeId: assets.typeId, c: count() })
    .from(assets)
    .groupBy(assets.typeId)
    .all()
  const usageByTypeId = new Map(typeIdUsageRows.map((r) => [r.typeId, Number(r.c ?? 0)]))

  const userItems: CategoryItem[] = rows.map((c) => ({
    ...c,
    kind: 'user' as const,
    usageCount: usageByTypeId.get(c.id) ?? 0
  }))

  const fileTypeUsageMap = new Map<string, number>()
  for (const [typeId, usage] of usageByTypeId) {
    const ft = fileTypeFromSystemTypeCategoryId(typeId)
    if (ft) fileTypeUsageMap.set(ft, usage)
  }
  const systemItems = buildSystemCategoryItems(fileTypeUsageMap)

  return [...userItems, ...systemItems]
}

export async function getCategoryById(id: string): Promise<CategoryItem | null> {
  if (isSystemTypeCategoryId(id)) {
    if (!fileTypeFromSystemTypeCategoryId(id)) return null
    const items = await listCategories()
    return items.find((c) => c.id === id) ?? null
  }

  const database = getDatabase()
  const row = await database.select().from(categories).where(eq(categories.id, id)).get()
  if (!row) return null

  const usageRow = await database
    .select({ c: count() })
    .from(assets)
    .where(eq(assets.typeId, id))
    .get()

  return {
    ...row,
    kind: 'user' as const,
    usageCount: Number(usageRow?.c ?? 0)
  }
}

export type CreateCategoryInput = {
  name: string
  color?: string
  icon?: string | null
  description?: string | null
}

export async function createCategory(data: CreateCategoryInput): Promise<CategoryItem> {
  const database = getDatabase()
  const id = uuidv4()
  const color = data.color || '#FF9F1C'
  const icon = data.icon?.trim() || null
  const description = data.description ?? null
  const last = await database
    .select({ sortOrder: categories.sortOrder })
    .from(categories)
    .orderBy(desc(categories.sortOrder))
    .limit(1)
    .get()
  const sortOrder = (last?.sortOrder ?? -1) + 1

  await database.insert(categories).values({
    id,
    name: data.name.trim(),
    color,
    icon,
    description,
    sortOrder
  })

  return {
    id,
    name: data.name.trim(),
    color,
    icon,
    description,
    kind: 'user',
    usageCount: 0,
    sortOrder,
    createdAt: new Date()
  }
}

export async function updateCategory(id: string, data: Record<string, unknown>): Promise<boolean> {
  if (isSystemTypeCategoryId(id)) return false
  const database = getDatabase()
  await database.update(categories).set(data as any).where(eq(categories.id, id))
  await rebuildSearchTextForCategory(database, id)
  return true
}

export async function deleteCategory(id: string): Promise<boolean> {
  if (isSystemTypeCategoryId(id)) return false
  const database = getDatabase()
  await rebuildSearchTextForCategory(database, id)
  await database
    .update(assets)
    .set({
      typeId: sql`'__sys:' || ${assets.fileType}`,
      updatedAt: new Date()
    })
    .where(eq(assets.typeId, id))
  await database.delete(categories).where(eq(categories.id, id))
  await refreshUserCategoryUsageCounts(database)
  return true
}

async function assertValidTypeId(database: ReturnType<typeof getDatabase>, typeId: string): Promise<void> {
  if (isSystemTypeCategoryId(typeId)) {
    if (!fileTypeFromSystemTypeCategoryId(typeId)) {
      throw new Error(`Invalid system type id: ${typeId}`)
    }
    return
  }
  const row = await database.select({ id: categories.id }).from(categories).where(eq(categories.id, typeId)).get()
  if (!row) throw new Error(`Category not found: ${typeId}`)
}

export async function setAssetsType(assetIds: string[], typeId: string): Promise<boolean> {
  if (assetIds.length === 0) return true
  const database = getDatabase()
  await assertValidTypeId(database, typeId)
  const now = new Date()
  await database
    .update(assets)
    .set({ typeId, updatedAt: now })
    .where(inArray(assets.id, assetIds))
  for (const assetId of assetIds) {
    await finalizeAssetRecords(database, assetId)
  }
  await refreshUserCategoryUsageCounts(database)
  return true
}

/** Reset effective type to detected format (`__sys:{file_type}`). */
export async function resetAssetsTypeToDetected(assetIds: string[]): Promise<boolean> {
  if (assetIds.length === 0) return true
  const database = getDatabase()
  const rows = await database
    .select({ id: assets.id, fileType: assets.fileType })
    .from(assets)
    .where(inArray(assets.id, assetIds))
    .all()
  const now = new Date()
  for (const row of rows) {
    const typeId = defaultTypeIdForFileType(row.fileType as FileType)
    await database.update(assets).set({ typeId, updatedAt: now }).where(eq(assets.id, row.id))
    await finalizeAssetRecords(database, row.id)
  }
  await refreshUserCategoryUsageCounts(database)
  return true
}

/** @deprecated Use setAssetsType with a single typeId */
export async function assignCategoriesToAssets(
  assetIds: string[],
  categoryIds: string[]
): Promise<boolean> {
  const typeId = categoryIds[0]
  if (!typeId) return true
  return setAssetsType(assetIds, typeId)
}

/** @deprecated Use resetAssetsTypeToDetected */
export async function removeCategoriesFromAssets(
  assetIds: string[],
  _categoryIds: string[]
): Promise<boolean> {
  return resetAssetsTypeToDetected(assetIds)
}

export async function mapSourceTypeIdToTarget(
  targetDb: ReturnType<typeof getDatabase>,
  sourceDb: ReturnType<typeof getDatabase>,
  sourceTypeId: string | null | undefined,
  sourceFileType: string
): Promise<string> {
  const fallback = defaultTypeIdForFileType((sourceFileType || 'other') as FileType)
  const raw = sourceTypeId?.trim()
  if (!raw || isSystemTypeCategoryId(raw)) {
    return fileTypeFromSystemTypeCategoryId(raw ?? '') ? raw! : fallback
  }
  const cat = await sourceDb.select().from(categories).where(eq(categories.id, raw)).get()
  if (!cat) return fallback
  const { mapOrCreateTargetCategory } = await import('./importLibraryShared')
  return mapOrCreateTargetCategory(
    targetDb,
    cat.name,
    cat.color,
    cat.icon,
    cat.description,
    cat.sortOrder ?? 0
  )
}
