import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, statSync, readdirSync, readFileSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { db, flushDatabase, persistDatabase, getDatabase } from '../../db'
import { assets, assetTags, assetFolders, assetsSearch } from '../../db/schema'
import { eq, and, like, inArray, desc, asc, sql, count, type SQL } from 'drizzle-orm'
import type { AssetItem, QueryParams, QueryResult, ImportProgress } from '@/shared/types'
import type { DuplicatePolicy, ImportAssetOptions } from '@/shared/importTypes'
import { importSingleAsset, type ImportSingleAssetOptions } from '../../services/importSingleAsset'
import { getFileWatcher } from '../../services/FileWatcher'
import { getThumbnailService } from '../../services/ThumbnailService'
import { isModelThumbnailSkipped } from '../../services/modelThumbnailSkip'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
import { resolveLibraryPath, removeItemPack, itemThumbRelative } from '../../services/libraryBundle'
import { syncAssetSidecarFromDb } from '../../services/assetSidecar'
import { analyzeColorsFromFile } from '../../services/analyzeAssetColors'
import { bufferToImageDataUrl, shouldUseOriginalImageDimensions } from '../../utils/thumbnailSizing'
import { renameAsset } from '../../services/renameAsset'
import { copyAssetsToOtherLibrary } from '../../services/copyAssetsToOtherLibrary'
import { promptDuplicateImport, registerDuplicateImportPromptHandlers } from '../../services/duplicateImportPrompt'
import { scanLibraryContentHashes } from '../../services/contentHashService'
import { regenerateFontThumbnails } from '../../services/regenerateFontThumbnails'

registerDuplicateImportPromptHandlers()

function normalizeImportOptions(
  optionsOrFolderId?: string | ImportAssetOptions
): ImportAssetOptions {
  if (typeof optionsOrFolderId === 'string') return { targetFolderId: optionsOrFolderId }
  return optionsOrFolderId ?? {}
}

function createImportSession(win: BrowserWindow | undefined) {
  let batchDuplicatePolicy: DuplicatePolicy | null = null

  const buildSingleImportOptions = (targetFolderId?: string): ImportSingleAssetOptions => ({
    targetFolderId,
    duplicatePolicy: batchDuplicatePolicy ?? 'ask',
    resolveDuplicate: async (payload) => {
      if (batchDuplicatePolicy === 'use_existing') {
        return { resolution: 'use_existing' }
      }
      if (batchDuplicatePolicy === 'import_copy') {
        return { resolution: 'import_copy' }
      }
      const answer = await promptDuplicateImport(win, payload)
      if (answer.applyToAll && answer.resolution !== 'cancel') {
        batchDuplicatePolicy = answer.resolution === 'use_existing' ? 'use_existing' : 'import_copy'
      }
      return answer
    }
  })

  return { buildSingleImportOptions }
}

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

async function getAssetFolderIds(database: ReturnType<typeof getDatabase>, assetId: string): Promise<string[]> {
  const results = await database
    .select({ folderId: assetFolders.folderId })
    .from(assetFolders)
    .where(eq(assetFolders.assetId, assetId))
    .all()
  return results.map((r) => r.folderId)
}

function attachResolvedPaths<T extends { filePath: string; thumbnailPath?: string | null }>(
  row: T
): T & { resolvedFilePath: string; resolvedThumbnailPath: string | null } {
  return {
    ...row,
    resolvedFilePath: resolveLibraryPath(row.filePath),
    resolvedThumbnailPath: row.thumbnailPath ? resolveLibraryPath(row.thumbnailPath) : null
  }
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
          getAssetTags(database, item.id),
          getAssetFolderIds(database, item.id)
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

      const [tagIds, folderIds] = await Promise.all([
        getAssetTags(database, id),
        getAssetFolderIds(database, id)
      ])
      persistDatabase()
      return { ...attachResolvedPaths(item), tagIds, folderIds }
    }

    return item ?? null
  })

  ipc.handle('assets:import', async (event, filePaths: string[], optionsOrFolderId?: string | ImportAssetOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const importOptions = normalizeImportOptions(optionsOrFolderId)
    const session = createImportSession(win ?? undefined)
    const results: string[] = []

    const sendProgress = (data: ImportProgress) => {
      try {
        win?.webContents.send('import:progress', data)
      } catch {
        /* window gone */
      }
    }

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

        sendProgress(progressData)

        const asset = await importSingleAsset(
          filePath,
          session.buildSingleImportOptions(importOptions.targetFolderId)
        )
        if (asset) {
          results.push(asset)
          try {
            getFileWatcher().watch(dirname(filePath))
          } catch (e) {
            console.warn('[Import] watch:', e)
          }
        }

        progressData.status = 'done'
        sendProgress(progressData)
      } catch (error) {
        console.error(`[Import] Error importing ${basename(filePath)}:`, error)

        sendProgress({
          current: i + 1,
          total: filePaths.length,
          filename: basename(filePath),
          status: 'error'
        })
      }
    }

    await flushDatabase()
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('assets:imported')
    }
    return results
  })

  ipc.handle('assets:import-folder', async (event, folderPath: string, optionsOrFolderId?: string | ImportAssetOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const importOptions = normalizeImportOptions(optionsOrFolderId)
    const session = createImportSession(win)
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
        const asset = await importSingleAsset(
          fp,
          session.buildSingleImportOptions(importOptions.targetFolderId)
        )
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
    for (const id of ids) {
      removeItemPack(id)
    }
    await database.delete(assets).where(inArray(assets.id, ids))
    persistDatabase()
    return true
  })

  ipc.handle('assets:add-to-folders', async (_event, assetIds: string[], folderIds: string[]) => {
    const database = db!
    if (assetIds.length === 0 || folderIds.length === 0) return true
    for (const assetId of assetIds) {
      for (const folderId of folderIds) {
        const existing = await database
          .select()
          .from(assetFolders)
          .where(and(eq(assetFolders.assetId, assetId), eq(assetFolders.folderId, folderId)))
          .get()
        if (!existing) {
          await database.insert(assetFolders).values({ assetId, folderId })
        }
      }
      await syncAssetSidecarFromDb(database, assetId)
    }
    persistDatabase()
    return true
  })

  ipc.handle('assets:remove-from-folders', async (_event, assetIds: string[], folderIds: string[]) => {
    const database = db!
    if (assetIds.length === 0 || folderIds.length === 0) return true
    await database
      .delete(assetFolders)
      .where(and(inArray(assetFolders.assetId, assetIds), inArray(assetFolders.folderId, folderIds)))
    for (const id of assetIds) {
      await syncAssetSidecarFromDb(database, id)
    }
    persistDatabase()
    return true
  })

  /** @deprecated Use assets:add-to-folders — kept for compatibility; adds to folder without removing others */
  ipc.handle('assets:move', async (_event, ids: string[], targetFolderId: string) => {
    const database = db!
    for (const assetId of ids) {
      const existing = await database
        .select()
        .from(assetFolders)
        .where(and(eq(assetFolders.assetId, assetId), eq(assetFolders.folderId, targetFolderId)))
        .get()
      if (!existing) {
        await database.insert(assetFolders).values({ assetId, folderId: targetFolderId })
      }
      await syncAssetSidecarFromDb(database, assetId)
    }
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
    await syncAssetSidecarFromDb(database, id)
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
    await syncAssetSidecarFromDb(database, id)
    return true
  })

  ipc.handle('assets:rename', async (_event, id: string, newName: string) => {
    return renameAsset(id, newName)
  })

  ipc.handle('assets:analyze-colors-batch', async (_event, ids: string[]) => {
    const database = db!
    let updated = 0
    for (const id of ids) {
      const asset = await database.select().from(assets).where(eq(assets.id, id)).get()
      if (!asset || (asset.fileType !== 'image' && asset.fileType !== 'video')) continue
      const absFile = resolveLibraryPath(asset.filePath)
      const result = await analyzeColorsFromFile(absFile, asset.fileType)
      if (!result) continue
      await database
        .update(assets)
        .set({
          dominantColor: result.dominantColor,
          colors: result.colorsJson,
          updatedAt: new Date()
        })
        .where(eq(assets.id, id))
      await syncAssetSidecarFromDb(database, id)
      updated++
    }
    if (updated > 0) persistDatabase()
    return { updated }
  })

  ipc.handle('assets:copy-to-library', async (_event, assetIds: string[], targetLibraryRoot: string) => {
    return copyAssetsToOtherLibrary(assetIds, targetLibraryRoot)
  })

  ipc.handle('assets:analyze-colors', async (_event, id: string) => {
    const database = db!
    const asset = await database.select().from(assets).where(eq(assets.id, id)).get()
    if (!asset) return null
    if (asset.fileType !== 'image' && asset.fileType !== 'video') return null

    const absFile = resolveLibraryPath(asset.filePath)
    const result = await analyzeColorsFromFile(absFile, asset.fileType)
    if (!result) return null

    await database
      .update(assets)
      .set({
        dominantColor: result.dominantColor,
        colors: result.colorsJson,
        updatedAt: new Date()
      })
      .where(eq(assets.id, id))
    persistDatabase()
    await syncAssetSidecarFromDb(database, id)

    return { dominantColor: result.dominantColor, colors: result.colors }
  })

  ipc.handle('assets:get-thumbnail', async (_event, id: string) => {
    const database = db!
    const asset = await database
      .select({
        id: assets.id,
        filePath: assets.filePath,
        fileType: assets.fileType,
        mimeType: assets.mimeType,
        width: assets.width,
        height: assets.height,
        thumbnailPath: assets.thumbnailPath,
        hasThumbnail: assets.hasThumbnail
      })
      .from(assets)
      .where(eq(assets.id, id))
      .get()

    if (!asset) return null

    const readWebpDataUrl = (storedPath: string): string | null => {
      try {
        const abs = resolveLibraryPath(storedPath)
        if (!existsSync(abs)) return null
        const buffer = readFileSync(abs)
        return `data:image/webp;base64,${buffer.toString('base64')}`
      } catch {
        return null
      }
    }

    const absFile = asset.filePath ? resolveLibraryPath(asset.filePath) : ''

    if (
      asset.fileType === 'image' &&
      absFile &&
      existsSync(absFile) &&
      shouldUseOriginalImageDimensions(asset.width, asset.height)
    ) {
      try {
        const buffer = readFileSync(absFile)
        return bufferToImageDataUrl(buffer, asset.mimeType || 'image/jpeg')
      } catch {
        // fall through
      }
    }

    if (asset.thumbnailPath) {
      const fromDisk = readWebpDataUrl(asset.thumbnailPath)
      if (fromDisk) return fromDisk
    }

    if (asset.fileType === 'image' && absFile && existsSync(absFile)) {
      const gen = await getThumbnailService().generate(absFile, asset.id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (gen?.buffer?.length) {
        if (!gen.usedOriginal) {
          const relThumb = itemThumbRelative(asset.id)
          await database
            .update(assets)
            .set({
              thumbnailPath: relThumb,
              hasThumbnail: true,
              updatedAt: new Date()
            })
            .where(eq(assets.id, id))
          persistDatabase()
          const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
          return `data:image/webp;base64,${buf.toString('base64')}`
        }
        return bufferToImageDataUrl(gen.buffer, asset.mimeType || 'image/jpeg')
      }
    }

    if (asset.fileType === 'video' && absFile && existsSync(absFile)) {
      const gen = await getThumbnailService().generateVideo(absFile, asset.id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (gen?.buffer?.length) {
        const relThumb = itemThumbRelative(asset.id)
        await database
          .update(assets)
          .set({
            thumbnailPath: relThumb,
            hasThumbnail: true,
            updatedAt: new Date()
          })
          .where(eq(assets.id, id))
        persistDatabase()
        const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
        return `data:image/webp;base64,${buf.toString('base64')}`
      }
    }

    if (asset.fileType === 'font' && absFile && existsSync(absFile)) {
      const gen = await getThumbnailService().generateFont(absFile, asset.id, {
        width: 512,
        height: 512,
        quality: 85
      })
      if (gen?.buffer?.length) {
        const relThumb = itemThumbRelative(asset.id)
        await database
          .update(assets)
          .set({
            thumbnailPath: relThumb,
            hasThumbnail: true,
            updatedAt: new Date()
          })
          .where(eq(assets.id, id))
        persistDatabase()
        const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
        return `data:image/webp;base64,${buf.toString('base64')}`
      }
    }

    if (asset.fileType === '3d' && absFile && existsSync(absFile) && !isModelThumbnailSkipped(asset.id)) {
      const ext = asset.filePath.split('.').pop() ?? ''
      const gen = await getThumbnailService().generateModel(absFile, asset.id, ext, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (gen?.buffer?.length) {
        const relThumb = itemThumbRelative(asset.id)
        await database
          .update(assets)
          .set({
            thumbnailPath: relThumb,
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

  ipc.handle('assets:scan-content-hashes', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    const result = await scanLibraryContentHashes((data) => {
      try {
        win?.webContents.send('content-hash:scan-progress', data)
      } catch {
        /* window gone */
      }
    })

    await flushDatabase()
    return result
  })

  ipc.handle('assets:regenerate-font-thumbnails', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    const result = await regenerateFontThumbnails((data) => {
      try {
        win?.webContents.send('font-thumb:regenerate-progress', data)
      } catch {
        /* window gone */
      }
    })

    await flushDatabase()
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('assets:imported')
    }
    return result
  })
}
