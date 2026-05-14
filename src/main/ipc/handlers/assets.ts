import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, statSync, readdirSync, readFileSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { db, flushDatabase, persistDatabase, getDatabase } from '../../db'
import { assets, assetTags, assetsSearch } from '../../db/schema'
import { eq, and, like, inArray, desc, asc, sql, count, type SQL } from 'drizzle-orm'
import type { AssetItem, QueryParams, QueryResult, ImportProgress } from '@/shared/types'
import { importSingleAsset } from '../../services/importSingleAsset'
import { getFileWatcher } from '../../services/FileWatcher'
import { getThumbnailService } from '../../services/ThumbnailService'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'

function escapeSqlLikePattern(raw: string): string {
  return raw.replace(/%/g, ' ').replace(/_/g, ' ')
}

async function getAssetTags(database: ReturnType<typeof getDatabase>, assetId: string): Promise<string[]> {
  const results = await database
    .select({ tagId: assetTags.tagId })
    .from(assetTags)
    .where(eq(assetTags.assetId, assetId))
    .all()
  return results.map((r) => r.tagId)
}

export function handleAssetOperations(ipc: typeof ipcMain): void {
  ipc.handle('assets:query', async (_event, params: QueryParams = {}) => {
    const database = db!
    const page = params.page ?? 1
    const rawSize = params.pageSize ?? 80
    const pageSize = Math.min(200, Math.max(1, rawSize))
    const offset =
      typeof params.offset === 'number' && params.offset >= 0
        ? params.offset
        : (page - 1) * pageSize

    const conditions: SQL[] = []

    if (params.search?.trim()) {
      const searchTerm = `%${escapeSqlLikePattern(params.search.trim())}%`
      const searchResults = await database
        .select({ assetId: assetsSearch.assetId })
        .from(assetsSearch)
        .where(like(assetsSearch.searchText, searchTerm))
        .all()

      if (searchResults.length > 0) {
        conditions.push(inArray(assets.id, searchResults.map((r) => r.assetId)))
      } else {
        return { items: [], total: 0, page: 1, pageSize, totalPages: 0 }
      }
    }

    if (params.folderId) {
      conditions.push(eq(assets.folderId, params.folderId))
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
        const tagIds = await getAssetTags(database, item.id)
        return { ...item, tagIds }
      })
    )

    const pageComputed = Math.floor(offset / pageSize) + 1

    return {
      items: itemsWithTags,
      total,
      page: pageComputed,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    } as QueryResult<AssetItem>
  })

  ipc.handle('assets:get-by-id', async (_event, id: string) => {
    const database = db!
    const item = await database.select().from(assets).where(eq(assets.id, id)).get()

    if (item) {
      await database
        .update(assets)
        .set({ viewCount: sql`${assets.viewCount} + 1`, accessCount: sql`${assets.accessCount} + 1` })
        .where(eq(assets.id, id))

      const tagIds = await getAssetTags(database, id)
      persistDatabase()
      return { ...item, tagIds }
    }

    return item ?? null
  })

  ipc.handle('assets:import', async (event, filePaths: string[], targetFolderId?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const results: string[] = []

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]

      try {
        if (!existsSync(filePath)) continue

        const stat = statSync(filePath)
        if (!stat.isFile()) continue

        const progressData: ImportProgress = {
          current: i + 1,
          total: filePaths.length,
          filename: basename(filePath),
          status: 'processing'
        }

        win.webContents.send('import:progress', progressData)

        const asset = await importSingleAsset(filePath, targetFolderId)
        if (asset) {
          results.push(asset)
          try {
            getFileWatcher().watch(dirname(filePath))
          } catch (e) {
            console.warn('[Import] watch:', e)
          }
        }

        progressData.status = 'done'
        win.webContents.send('import:progress', progressData)
      } catch (error) {
        console.error(`[Import] Error importing ${basename(filePath)}:`, error)

        win.webContents.send('import:progress', {
          current: i + 1,
          total: filePaths.length,
          filename: basename(filePath),
          status: 'error'
        })
      }
    }

    await flushDatabase()
    return results
  })

  ipc.handle('assets:import-folder', async (event, folderPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const supportedExts = ALL_SUPPORTED_IMPORT_EXTENSIONS

    function scanDir(dir: string): string[] {
      const results: string[] = []
      const entries = readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          results.push(...scanDir(fullPath))
        } else if (supportedExts.has(extname(entry.name).toLowerCase())) {
          results.push(fullPath)
        }
      }

      return results
    }

    const allFiles = scanDir(folderPath)
    const imported: string[] = []

    for (let i = 0; i < allFiles.length; i++) {
      try {
        win.webContents.send('import:progress', {
          current: i + 1,
          total: allFiles.length,
          filename: basename(allFiles[i]),
          status: 'processing'
        })

        const fp = allFiles[i]
        const asset = await importSingleAsset(fp)
        if (asset) {
          imported.push(asset)
          try {
            getFileWatcher().watch(dirname(fp))
          } catch (e) {
            console.warn('[Import] watch:', e)
          }
        }

        win.webContents.send('import:progress', {
          current: i + 1,
          total: allFiles.length,
          filename: basename(allFiles[i]),
          status: 'done'
        })
      } catch (error) {
        console.error(`[Import] Folder import error:`, error)
      }
    }

    await flushDatabase()
    return imported
  })

  ipc.handle('assets:delete', async (_event, ids: string[]) => {
    const database = db!
    await database.delete(assets).where(inArray(assets.id, ids))
    persistDatabase()
    return true
  })

  ipc.handle('assets:move', async (_event, ids: string[], targetFolderId: string) => {
    const database = db!
    await database
      .update(assets)
      .set({ folderId: targetFolderId, updatedAt: new Date() })
      .where(inArray(assets.id, ids))
    persistDatabase()
    return true
  })

  ipc.handle('assets:update-metadata', async (_event, id: string, metadata: Record<string, unknown>) => {
    const database = db!
    await database
      .update(assets)
      .set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
      .where(eq(assets.id, id))
    persistDatabase()
    return true
  })

  ipc.handle('assets:update-notes', async (_event, id: string, notes: unknown) => {
    const database = db!
    const raw = typeof notes === 'string' ? notes : ''
    const trimmed = raw.slice(0, 16000)
    await database
      .update(assets)
      .set({ notes: trimmed.length > 0 ? trimmed : null, updatedAt: new Date() })
      .where(eq(assets.id, id))
    persistDatabase()
    return true
  })

  ipc.handle('assets:get-thumbnail', async (_event, id: string) => {
    const database = db!
    const asset = await database
      .select({
        id: assets.id,
        filePath: assets.filePath,
        fileType: assets.fileType,
        thumbnailPath: assets.thumbnailPath,
        hasThumbnail: assets.hasThumbnail
      })
      .from(assets)
      .where(eq(assets.id, id))
      .get()

    if (!asset) return null

    const readWebpDataUrl = (p: string): string | null => {
      try {
        if (!existsSync(p)) return null
        const buffer = readFileSync(p)
        return `data:image/webp;base64,${buffer.toString('base64')}`
      } catch {
        return null
      }
    }

    if (asset.thumbnailPath) {
      const fromDisk = readWebpDataUrl(asset.thumbnailPath)
      if (fromDisk) return fromDisk
    }

    if (asset.fileType === 'image' && asset.filePath && existsSync(asset.filePath)) {
      const gen = await getThumbnailService().generate(asset.filePath, asset.id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (gen?.buffer?.length) {
        await database
          .update(assets)
          .set({
            thumbnailPath: gen.path,
            hasThumbnail: true,
            updatedAt: new Date()
          })
          .where(eq(assets.id, id))
        persistDatabase()
        const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
        return `data:image/webp;base64,${buf.toString('base64')}`
      }
    }

    if (asset.fileType === 'video' && asset.filePath && existsSync(asset.filePath)) {
      const gen = await getThumbnailService().generateVideo(asset.filePath, asset.id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (gen?.buffer?.length) {
        await database
          .update(assets)
          .set({
            thumbnailPath: gen.path,
            hasThumbnail: true,
            updatedAt: new Date()
          })
          .where(eq(assets.id, id))
        persistDatabase()
        const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
        return `data:image/webp;base64,${buf.toString('base64')}`
      }
    }

    return null
  })
}
