import { v4 as uuidv4 } from 'uuid'
import { existsSync, unlinkSync } from 'fs'
import { join, sep } from 'path'
import { getDatabase } from '../db'
import { folders, assetFolders } from '../db/schema'
import type { Folder } from '../db/schema'
import { eq, asc, countDistinct, and, inArray } from 'drizzle-orm'
import type { FolderItem } from '@/shared/types'
import { getLibraryRoot } from './libraryBundle'
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
  } catch {
    /* ignore */
  }
}

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

export async function listFolders(): Promise<FolderItem[]> {
  const database = getDatabase()
  const rows = await database.select().from(folders).orderBy(asc(folders.name)).all()
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
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    level: f.level,
    assetCount: countMap.get(f.id) ?? 0,
    color: f.color ?? '#64748b',
    icon: f.icon ?? null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt
  }))
}

export async function getFolderTree(): Promise<FolderItem[]> {
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
}

export type CreateFolderInput = {
  name: string
  parentId?: string | null
  color?: string
  icon?: string | null
}

export async function createFolder(data: CreateFolderInput): Promise<FolderItem> {
  const database = getDatabase()
  const id = uuidv4()
  const parentData = data.parentId
    ? await database.select().from(folders).where(eq(folders.id, data.parentId)).get()
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
  }
}

export type UpdateFolderInput = {
  name?: string
  parentId?: string
  color?: string
  icon?: string | null
}

export async function updateFolder(id: string, data: UpdateFolderInput): Promise<boolean> {
  const database = getDatabase()

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
    if (!folder) return false

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

export async function deleteFolder(id: string): Promise<boolean> {
  const database = getDatabase()
  const row = await database.select().from(folders).where(eq(folders.id, id)).get()
  if (row?.icon && typeof row.icon === 'string' && isFolderIconStoredPath(row.icon)) {
    tryRemoveFolderIconFile(row.icon)
  }
  await database.delete(folders).where(eq(folders.id, id))
  return true
}

export async function moveFolder(id: string, newParentId: string | null): Promise<boolean> {
  const database = getDatabase()
  const folder = await database.select().from(folders).where(eq(folders.id, id)).get()
  if (!folder) throw new Error('Folder not found')

  if (!newParentId) {
    const oldPath = folder.path
    const newPath = `/${folder.name}`
    const newLevel = 0
    const levelDelta = newLevel - folder.level
    const all = await database.select().from(folders).all()
    const subtree = all.filter((f) => f.path === folder.path || f.path.startsWith(`${folder.path}/`))
    for (const row of subtree) {
      if (row.level + levelDelta > MAX_FOLDER_LEVEL) {
        throw new Error('Move would exceed max folder depth (5 levels)')
      }
    }
    await database
      .update(folders)
      .set({ parentId: null, path: newPath, level: newLevel, updatedAt: new Date() })
      .where(eq(folders.id, id))
    if (newPath !== oldPath) {
      await updateDescendantPaths(database, oldPath, newPath, levelDelta)
    }
    return true
  }

  const newParent = await database.select().from(folders).where(eq(folders.id, newParentId)).get()
  if (!newParent) throw new Error('Folder or target not found')

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
}

export async function getFolderById(id: string): Promise<FolderItem | null> {
  const list = await listFolders()
  return list.find((f) => f.id === id) ?? null
}
