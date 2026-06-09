import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, copyFileSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { join, sep, extname } from 'path'
import { getDatabase } from '../../db'
import { folders, assetFolders, assets } from '../../db/schema'
import { eq, asc, countDistinct, and, inArray, or, desc } from 'drizzle-orm'
import type { Folder } from '../../db/schema'
import type { FolderItem } from '@/shared/types'
import { getLibraryRoot } from '../../services/libraryBundle'
import { toCanonicalFilePath } from '../../utils/pathUtils'
import { assertPlainObject, assertString, assertStringArray } from '../ipcGuards'
import { MAX_FOLDER_LEVEL } from '@/shared/folderLimits'
const FOLDER_ICONS_PREFIX = 'folder-icons/'

function isFolderIconStoredPath(icon: string): boolean {
  return icon.startsWith(FOLDER_ICONS_PREFIX)
}

function tryRemoveFolderIconFile(relativePath: string): void {
  try {
    const root = getLibraryRoot()
    const abs = join(root, relativePath.split('/').join(sep))
    if (existsSync(abs)) unlinkSync(abs)
  } catch (err) {
    /* best-effort cleanup — non-fatal if file is locked or missing */
    console.warn(`[folders] Failed to remove folder icon ${relativePath}:`, err)
  }
}

function mimeForIconExt(ext: string): string {
  switch (ext) {
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'image/jpeg'
  }
}

export function handleFolderOperations(ipc: typeof ipcMain): void {
  ipc.handle('folders:list', async () => {
    const database = getDatabase()
    return database.select().from(folders).orderBy(asc(folders.name)).all()
  })

  ipc.handle('folders:get-tree', async () => {
    const database = getDatabase()
    const allFolders = await database.select().from(folders).orderBy(asc(folders.name)).all()
    const countRows = await database
      .select({
        folderId: assetFolders.folderId,
        c: countDistinct(assetFolders.assetId)
      })
      .from(assetFolders)
      .groupBy(assetFolders.folderId)
      .all()
    const countMap = new Map<string, number>()
    for (const row of countRows) {
      if (row.folderId) countMap.set(row.folderId, Number(row.c ?? 0))
    }
    return buildFolderTree(allFolders, countMap)
  })

  ipc.handle('folders:set-cover', async (_event, folderId: string, assetId: string) => {
    const database = getDatabase()
    assertString('folderId', folderId)
    assertString('assetId', assetId)
    const asset = await database.select().from(assets).where(eq(assets.id, assetId)).get()
    if (!asset) throw new Error('资产不存在')
    if (asset.fileType !== 'image' && !asset.hasThumbnail) {
      throw new Error('仅支持有缩略图的图片或视频作为封面')
    }
    const link = await database
      .select()
      .from(assetFolders)
      .where(and(eq(assetFolders.folderId, folderId), eq(assetFolders.assetId, assetId)))
      .get()
    if (!link) throw new Error('请先将资产加入该文件夹')
    await database
      .update(folders)
      .set({ coverAssetId: assetId, updatedAt: new Date() })
      .where(eq(folders.id, folderId))
    return true
  })

  /** For each folder id, pick cover: manual cover_asset_id, else recent image/thumb. */
  ipc.handle('folders:get-cover-asset-ids', async (_event, folderIds: string[]) => {
    const database = getDatabase()
    assertStringArray('folderIds', folderIds)
    if (!folderIds.length) return {}
    const map: Record<string, string> = {}

    const folderRows = await database
      .select({ id: folders.id, coverAssetId: folders.coverAssetId })
      .from(folders)
      .where(inArray(folders.id, folderIds))
      .all()
    for (const f of folderRows) {
      if (f.coverAssetId) map[f.id] = f.coverAssetId
    }

    const needAuto = folderIds.filter((id) => !map[id])
    if (needAuto.length === 0) return map

    const rows = await database
      .select({
        folderId: assetFolders.folderId,
        assetId: assets.id,
        importedAt: assets.importedAt
      })
      .from(assetFolders)
      .innerJoin(assets, eq(assets.id, assetFolders.assetId))
      .where(
        and(
          inArray(assetFolders.folderId, needAuto),
          or(eq(assets.fileType, 'image'), eq(assets.hasThumbnail, true))
        )
      )
      .orderBy(desc(assets.importedAt))
      .all()

    for (const row of rows) {
      if (row.folderId && !map[row.folderId]) {
        map[row.folderId] = row.assetId
      }
    }
    return map
  })

  ipc.handle('folders:import-icon-from-file', async (_event, sourcePath: string) => {
    assertString('sourcePath', sourcePath)
    const src = toCanonicalFilePath(sourcePath)
    if (!existsSync(src)) throw new Error('File not found')
    const st = statSync(src)
    if (!st.isFile()) throw new Error('Not a file')
    if (st.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2 MB)')
    const ext = extname(src).toLowerCase()
    const ok = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg'])
    if (!ok.has(ext)) throw new Error('Unsupported image type')
    const root = getLibraryRoot()
    const dir = join(root, 'folder-icons')
    mkdirSync(dir, { recursive: true })
    const id = uuidv4()
    const rel = `${FOLDER_ICONS_PREFIX}${id}${ext}`
    const dest = join(root, rel.split('/').join(sep))
    copyFileSync(src, dest)
    const buf = readFileSync(dest)
    const previewDataUrl = `data:${mimeForIconExt(ext)};base64,${buf.toString('base64')}`
    return { relativePath: rel, previewDataUrl }
  })

  ipc.handle('folders:delete-stored-icon', async (_event, relativePath: string) => {
    assertString('relativePath', relativePath)
    if (!relativePath || !isFolderIconStoredPath(relativePath)) return false
    tryRemoveFolderIconFile(relativePath)
    return true
  })

  ipc.handle('folders:get-icon-data-url', async (_event, relativePath: string) => {
    assertString('relativePath', relativePath)
    if (!relativePath || !isFolderIconStoredPath(relativePath)) return null
    const root = getLibraryRoot()
    const abs = join(root, relativePath.split('/').join(sep))
    if (!existsSync(abs)) return null
    const buf = readFileSync(abs)
    if (buf.length > 512 * 1024) return null
    const ext = extname(abs).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg'].includes(ext)) return null
    return `data:${mimeForIconExt(ext)};base64,${buf.toString('base64')}`
  })

  ipc.handle(
    'folders:create',
    async (
      _event,
      data: { name: string; parentId?: string; color?: string; icon?: string | null }
    ) => {
      const database = getDatabase()
      const id = uuidv4()
      assertPlainObject('data', data)
      assertString('data.name', (data as any).name)
      if ((data as any).parentId != null) assertString('data.parentId', (data as any).parentId)
      const parentData = data.parentId
        ? await database.select().from(folders).where(eq(folders.id, data.parentId!)).get()
        : null

      if (parentData && parentData.level >= MAX_FOLDER_LEVEL) {
        throw new Error('Folder depth limit reached (max 5 levels)')
      }

      const level = parentData ? parentData.level + 1 : 0
      const path = parentData ? `${parentData.path}/${data.name}` : `/${data.name}`
      const color = data.color?.trim() || '#64748b'
      const icon = data.icon?.trim() ? data.icon.trim() : null

      await database.insert(folders).values({
        id,
        name: data.name,
        parentId: data.parentId || null,
        path,
        level,
        color,
        icon
      } as any)


      return {
        id,
        name: data.name,
        parentId: data.parentId || null,
        path,
        level,
        assetCount: 0,
        color,
        icon,
        createdAt: new Date(),
        updatedAt: new Date()
      } satisfies FolderItem
    }
  )

  ipc.handle(
    'folders:update',
    async (
      _event,
      id: string,
      data: { name?: string; parentId?: string; color?: string; icon?: string | null }
    ) => {
      const database = getDatabase()
      assertString('id', id)
      assertPlainObject('data', data)
      if ((data as any).parentId != null) assertString('data.parentId', (data as any).parentId)

      if (data.color !== undefined || data.icon !== undefined) {
        if (data.icon !== undefined) {
          const existing = await database.select().from(folders).where(eq(folders.id, id)).get()
          const oldIcon = existing?.icon
          const newIcon = data.icon?.trim() ? data.icon.trim() : null
          if (
            typeof oldIcon === 'string' &&
            isFolderIconStoredPath(oldIcon) &&
            oldIcon !== newIcon
          ) {
            tryRemoveFolderIconFile(oldIcon)
          }
        }
        const patch: Record<string, unknown> = { updatedAt: new Date() }
        if (data.color !== undefined) patch.color = data.color?.trim() || '#64748b'
        if (data.icon !== undefined) patch.icon = data.icon?.trim() ? data.icon.trim() : null
        await database.update(folders).set(patch as any).where(eq(folders.id, id))
      }

      if (data.name) {
        const folder = await database.select().from(folders).where(eq(folders.id, id)).get()
        if (!folder) {
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

      return true
    }
  )

  ipc.handle('folders:delete', async (_event, id: string) => {
    const database = getDatabase()
    assertString('id', id)
    const row = await database.select().from(folders).where(eq(folders.id, id)).get()
    if (row?.icon && typeof row.icon === 'string' && isFolderIconStoredPath(row.icon)) {
      tryRemoveFolderIconFile(row.icon)
    }
    await database.delete(folders).where(eq(folders.id, id))
    return true
  })

  ipc.handle('folders:move', async (_event, id: string, newParentId: string) => {
    const database = getDatabase()
    assertString('id', id)
    assertString('newParentId', newParentId)
    const [folder, newParent] = await Promise.all([
      database.select().from(folders).where(eq(folders.id, id)).get(),
      database.select().from(folders).where(eq(folders.id, newParentId)).get()
    ])

    if (!folder || !newParent) throw new Error('Folder or target not found')

    const oldPath = folder.path
    const newLevel = newParent.level + 1
    if (newLevel > MAX_FOLDER_LEVEL) {
      throw new Error('Folder depth limit reached (max 5 levels)')
    }

    const levelDelta = newLevel - folder.level
    const all = await database.select().from(folders).all()
    const subtree = all.filter((f) => f.path === folder.path || f.path.startsWith(`${folder.path}/`))
    for (const row of subtree) {
      if (row.level + levelDelta > MAX_FOLDER_LEVEL) {
        throw new Error('Move would exceed max folder depth (5 levels)')
      }
    }

    const newPath = `${newParent.path}/${folder.name}`

    await database
      .update(folders)
      .set({ parentId: newParentId, path: newPath, level: newLevel, updatedAt: new Date() })
      .where(eq(folders.id, id))

    if (newPath !== oldPath) {
      await updateDescendantPaths(database, oldPath, newPath, levelDelta)
    }

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
    const nextLevel = Math.min(Math.max(0, row.level + levelDelta), MAX_FOLDER_LEVEL)
    await database
      .update(folders)
      .set({ path: nextPath, level: nextLevel, updatedAt: new Date() })
      .where(eq(folders.id, row.id))
  }
}

function buildFolderTree(rows: Folder[], countMap: Map<string, number>): FolderItem[] {
  const map = new Map<string, FolderItem>()
  const roots: FolderItem[] = []

  for (const f of rows) {
    const item: FolderItem = {
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      path: f.path,
      level: f.level,
      assetCount: countMap.get(f.id) ?? 0,
      color: f.color ?? '#64748b',
      icon: f.icon ?? null,
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
