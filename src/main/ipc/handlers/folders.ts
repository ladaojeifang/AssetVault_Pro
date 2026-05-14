import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { db, persistDatabase, getDatabase } from '../../db'
import { folders } from '../../db/schema'
import { eq, asc } from 'drizzle-orm'
import type { Folder } from '../../db/schema'
import type { FolderItem } from '@/shared/types'

export function handleFolderOperations(ipc: typeof ipcMain): void {
  ipc.handle('folders:list', async () => {
    const database = db!
    return database.select().from(folders).orderBy(asc(folders.name)).all()
  })

  ipc.handle('folders:get-tree', async () => {
    const database = db!
    const allFolders = await database.select().from(folders).orderBy(asc(folders.name)).all()
    return buildFolderTree(allFolders)
  })

  ipc.handle('folders:create', async (_event, data: { name: string; parentId?: string }) => {
    const database = db!
    const id = uuidv4()
    const parentData = data.parentId
      ? await database.select().from(folders).where(eq(folders.id, data.parentId!)).get()
      : null

    const level = parentData ? Math.min(parentData.level + 1, 4) : 0
    const path = parentData ? `${parentData.path}/${data.name}` : `/${data.name}`

    await database.insert(folders).values({
      id,
      name: data.name,
      parentId: data.parentId || null,
      path,
      level
    } as any)

    persistDatabase()

    return {
      id,
      name: data.name,
      parentId: data.parentId || null,
      path,
      level,
      assetCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies FolderItem
  })

  ipc.handle('folders:update', async (_event, id: string, data: { name?: string; parentId?: string }) => {
    const database = db!

    if (data.name) {
      const folder = await database.select().from(folders).where(eq(folders.id, id)).get()
      if (!folder) {
        persistDatabase()
        return true
      }

      const oldPath = folder.path
      let newPath: string
      if (folder.parentId) {
        const parent = await database.select().from(folders).where(eq(folders.id, folder.parentId)).get()
        newPath = parent ? `${parent.path}/${data.name}` : `/${data.name}`
      } else {
        newPath = `/${data.name}`
      }

      if (newPath !== oldPath) {
        await database
          .update(folders)
          .set({ name: data.name, path: newPath, updatedAt: new Date() })
          .where(eq(folders.id, id))

        await updateDescendantPaths(database, oldPath, newPath)
      } else {
        await database.update(folders).set({ name: data.name, updatedAt: new Date() }).where(eq(folders.id, id))
      }
    }

    persistDatabase()
    return true
  })

  ipc.handle('folders:delete', async (_event, id: string) => {
    const database = db!
    await database.delete(folders).where(eq(folders.id, id))
    persistDatabase()
    return true
  })

  ipc.handle('folders:move', async (_event, id: string, newParentId: string) => {
    const database = db!
    const [folder, newParent] = await Promise.all([
      database.select().from(folders).where(eq(folders.id, id)).get(),
      database.select().from(folders).where(eq(folders.id, newParentId)).get()
    ])

    if (!folder || !newParent) throw new Error('Folder or target not found')

    const oldPath = folder.path
    const oldLevel = folder.level
    const newLevel = Math.min(newParent.level + 1, 4)
    const newPath = `${newParent.path}/${folder.name}`
    const levelDelta = newLevel - oldLevel

    await database
      .update(folders)
      .set({ parentId: newParentId, path: newPath, level: newLevel, updatedAt: new Date() })
      .where(eq(folders.id, id))

    if (newPath !== oldPath) {
      await updateDescendantPaths(database, oldPath, newPath, levelDelta)
    }

    persistDatabase()
    return true
  })
}

/** After a folder's path prefix changes, rewrite paths (and optional level delta) for descendants. */
async function updateDescendantPaths(
  database: ReturnType<typeof getDatabase>,
  oldRootPath: string,
  newRootPath: string,
  levelDelta = 0
): Promise<void> {
  const prefix = `${oldRootPath}/`
  const all = await database.select().from(folders).all()
  const descendants = all.filter((f) => f.path.startsWith(prefix) && f.path !== oldRootPath)

  for (const row of descendants) {
    const nextPath = newRootPath + row.path.slice(oldRootPath.length)
    const nextLevel = Math.min(Math.max(0, row.level + levelDelta), 4)
    await database
      .update(folders)
      .set({ path: nextPath, level: nextLevel, updatedAt: new Date() })
      .where(eq(folders.id, row.id))
  }
}

function buildFolderTree(rows: Folder[]): FolderItem[] {
  const map = new Map<string, FolderItem>()
  const roots: FolderItem[] = []

  for (const f of rows) {
    const item: FolderItem = {
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      path: f.path,
      level: f.level,
      assetCount: f.assetCount,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      children: []
    }
    map.set(item.id, item)
  }

  for (const [, item] of map) {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(item)
    } else {
      roots.push(item)
    }
  }

  return roots
}
