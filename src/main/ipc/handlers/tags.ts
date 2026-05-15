import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { db, persistDatabase, getDatabase } from '../../db'
import { tags, assetTags, assetsSearch, assets } from '../../db/schema'
import { eq, and, count, asc } from 'drizzle-orm'
import { syncAssetSidecarFromDb } from '../../services/assetSidecar'

async function rebuildAssetSearchText(database: ReturnType<typeof getDatabase>, assetId: string): Promise<void> {
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

export function handleTagOperations(ipc: typeof ipcMain): void {
  ipc.handle('tags:list', async () => {
    const database = db!
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
  })

  ipc.handle(
    'tags:create',
    async (_event, data: { name: string; color?: string; description?: string }) => {
      const database = db!
      const id = uuidv4()

      await database.insert(tags).values({
        id,
        name: data.name,
        color: data.color || '#3B82F6',
        description: data.description || null
      })

      persistDatabase()
      return { id, ...data }
    }
  )

  ipc.handle('tags:update', async (_event, id: string, data: Record<string, unknown>) => {
    const database = db!
    await database.update(tags).set(data as any).where(eq(tags.id, id))
    persistDatabase()
    return true
  })

  ipc.handle('tags:delete', async (_event, id: string) => {
    const database = db!
    await database.delete(tags).where(eq(tags.id, id))
    persistDatabase()
    return true
  })

  ipc.handle('tags:assign-to-assets', async (_event, assetIds: string[], tagIds: string[]) => {
    const database = db!

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

    persistDatabase()
    return true
  })

  ipc.handle('tags:remove-from-assets', async (_event, assetIds: string[], tagIds: string[]) => {
    const database = db!

    for (const assetId of assetIds) {
      for (const tagId of tagIds) {
        await database
          .delete(assetTags)
          .where(and(eq(assetTags.assetId, assetId), eq(assetTags.tagId, tagId)))
      }

      await rebuildAssetSearchText(database, assetId)
      await syncAssetSidecarFromDb(database, assetId)
    }

    persistDatabase()
    return true
  })
}
