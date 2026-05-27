import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db'
import { tags, assetTags } from '../db/schema'
import { eq, and, count, asc } from 'drizzle-orm'
import type { TagItem } from '@/shared/types'
import { syncAssetSidecarFromDb } from './assetSidecar'
import { rebuildAssetSearchText, rebuildSearchTextForTag } from './assetSearchIndex'

export async function listTags(): Promise<TagItem[]> {
  const database = getDatabase()
  const rows = await database.select().from(tags).orderBy(asc(tags.name)).all()
  const usageRows = await database
    .select({ tagId: assetTags.tagId, c: count() })
    .from(assetTags)
    .groupBy(assetTags.tagId)
    .all()
  const usageMap = new Map(usageRows.map((r) => [r.tagId, Number(r.c ?? 0)]))
  return rows.map((t) => ({
    ...t,
    usageCount: usageMap.get(t.id) ?? 0
  }))
}

export type CreateTagInput = {
  name: string
  color?: string
  description?: string | null
}

export async function createTag(data: CreateTagInput): Promise<TagItem> {
  const database = getDatabase()
  const id = uuidv4()
  const color = data.color || '#3B82F6'
  const description = data.description ?? null

  await database.insert(tags).values({
    id,
    name: data.name,
    color,
    description
  })

  return {
    id,
    name: data.name,
    color,
    description,
    usageCount: 0,
    createdAt: new Date()
  }
}

export async function updateTag(id: string, data: Record<string, unknown>): Promise<boolean> {
  const database = getDatabase()
  await database.update(tags).set(data as any).where(eq(tags.id, id))
  await rebuildSearchTextForTag(database, id)
  return true
}

export async function deleteTag(id: string): Promise<boolean> {
  const database = getDatabase()
  await rebuildSearchTextForTag(database, id)
  await database.delete(tags).where(eq(tags.id, id))
  return true
}

export async function assignTagsToAssets(assetIds: string[], tagIds: string[]): Promise<boolean> {
  const database = getDatabase()
  for (const assetId of assetIds) {
    for (const tagId of tagIds) {
      const existing = await database
        .select()
        .from(assetTags)
        .where(and(eq(assetTags.assetId, assetId), eq(assetTags.tagId, tagId)))
        .get()
      if (!existing) {
        await database.insert(assetTags).values({ assetId, tagId })
      }
    }
    await rebuildAssetSearchText(database, assetId)
    await syncAssetSidecarFromDb(database, assetId)
  }
  return true
}

export async function removeTagsFromAssets(assetIds: string[], tagIds: string[]): Promise<boolean> {
  const database = getDatabase()
  for (const assetId of assetIds) {
    for (const tagId of tagIds) {
      await database
        .delete(assetTags)
        .where(and(eq(assetTags.assetId, assetId), eq(assetTags.tagId, tagId)))
    }
    await rebuildAssetSearchText(database, assetId)
    await syncAssetSidecarFromDb(database, assetId)
  }
  return true
}

export async function getTagById(id: string): Promise<TagItem | null> {
  const all = await listTags()
  return all.find((t) => t.id === id) ?? null
}
