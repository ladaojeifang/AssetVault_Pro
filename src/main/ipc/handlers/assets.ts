import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, statSync, readdirSync, readFileSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { flushDatabase, getDatabase } from '../../db'
import { assets, assetTags, assetFolders } from '../../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import type { QueryParams, ImportProgress } from '@/shared/types'
import type { DuplicatePolicy, ImportAssetOptions } from '@/shared/importTypes'
import { importSingleAsset, type ImportSingleAssetOptions } from '../../services/importSingleAsset'
import { getFileWatcher } from '../../services/FileWatcher'
import { getThumbnailService } from '../../services/ThumbnailService'
import { isModelThumbnailSkipped, clearModelThumbnailSkip } from '../../services/modelThumbnailSkip'
import { waitForModelSnapshotBridge } from '../../services/modelThumbnailRenderer'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
import { isSvgExtension } from '@/shared/svgFormats'
import { resolveLibraryPath, itemThumbRelative } from '../../services/libraryBundle'
import { resolveAssetContentPath } from '../../services/assetPathResolver'
import { syncAssetSidecarFromDb } from '../../services/assetSidecar'
import { analyzeColorsFromFile } from '../../services/analyzeAssetColors'
import { queryAssets, getAssetById, deleteAssets } from '../../services/assetQueryService'
import { persistAssetColorAnalysis } from '../../services/persistAssetColors'
import { bufferToImageDataUrl, shouldUseOriginalImageDimensions } from '../../utils/thumbnailSizing'
import { renameAsset } from '../../services/renameAsset'
import { updateAssetNotes, updateAssetSourceUrl } from '../../services/assetMutationService'
import { copyAssetsToOtherLibrary } from '../../services/copyAssetsToOtherLibrary'
import { promptDuplicateImport, registerDuplicateImportPromptHandlers } from '../../services/duplicateImportPrompt'
import { scanLibraryContentHashes } from '../../services/contentHashService'
import { regenerateFontThumbnails } from '../../services/regenerateFontThumbnails'
import { regenerateModelThumbnails } from '../../services/regenerateModelThumbnails'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import {
  refreshAssetThumbnail,
  setCustomThumbnailFromClipboard,
  setCustomThumbnailFromFile,
  isCustomThumbnail
} from '../../services/assetThumbnailOverride'
import { notifyAllWindowsAssetsImported } from '../../services/importNotify'
import { isAutoWatchFoldersEnabled } from '../../services/appPreferencesStore'
import { assertPlainObject, assertString, assertStringArray } from '../ipcGuards'

registerDuplicateImportPromptHandlers()

function normalizeImportOptions(
  optionsOrFolderId?: string | ImportAssetOptions
): ImportAssetOptions {
  if (typeof optionsOrFolderId === 'string') return { targetFolderId: optionsOrFolderId }
  return optionsOrFolderId ?? {}
}

function resolveThumbPathForColorAnalysis(asset: {
  id: string
  thumbnailPath: string | null
  extension: string
  fileType: string
}): string | undefined {
  if (asset.thumbnailPath) {
    const abs = resolveLibraryPath(asset.thumbnailPath)
    if (existsSync(abs)) return abs
  }
  if (asset.fileType === 'image' && isSvgExtension(asset.extension)) {
    const abs = resolveLibraryPath(itemThumbRelative(asset.id))
    if (existsSync(abs)) return abs
  }
  return undefined
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

export function handleAssetOperations(ipc: typeof ipcMain): void {
  ipc.handle('assets:query', async (_event, rawParams: unknown) => {
    const params: QueryParams =
      rawParams != null && typeof rawParams === 'object' && !Array.isArray(rawParams)
        ? (rawParams as QueryParams)
        : {}
    return queryAssets(params)
  })

  ipc.handle('assets:get-by-id', async (_event, id: string) => {
    assertString('id', id)
    return getAssetById(id)
  })

  ipc.handle('assets:import', async (event, filePaths: string[], optionsOrFolderId?: string | ImportAssetOptions) => {
    assertStringArray('filePaths', filePaths)
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
            if (isAutoWatchFoldersEnabled()) {
              getFileWatcher().watch(dirname(filePath))
            }
          } catch (e) {
            console.warn('[Import] watch:', e)
          }
          notifyAllWindowsAssetsImported()
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
    notifyAllWindowsAssetsImported()
    return results
  })

  ipc.handle('assets:import-folder', async (event, folderPath: string, optionsOrFolderId?: string | ImportAssetOptions) => {
    assertString('folderPath', folderPath)
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
          if (isAutoWatchFoldersEnabled()) {
            try {
              getFileWatcher().watch(dirname(fp))
            } catch (e) {
              console.warn('[Import] watch:', e)
            }
          }
          notifyAllWindowsAssetsImported()
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
    notifyAllWindowsAssetsImported()
    return imported
  })

  ipc.handle('assets:delete', async (_event, ids: string[]) => {
    assertStringArray('ids', ids)
    await deleteAssets(ids)
    return true
  })

  ipc.handle('assets:add-to-folders', async (_event, assetIds: string[], folderIds: string[]) => {
    assertStringArray('assetIds', assetIds)
    assertStringArray('folderIds', folderIds)
    const database = getDatabase()
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
    return true
  })

  ipc.handle('assets:remove-from-folders', async (_event, assetIds: string[], folderIds: string[]) => {
    assertStringArray('assetIds', assetIds)
    assertStringArray('folderIds', folderIds)
    const database = getDatabase()
    if (assetIds.length === 0 || folderIds.length === 0) return true
    await database
      .delete(assetFolders)
      .where(and(inArray(assetFolders.assetId, assetIds), inArray(assetFolders.folderId, folderIds)))
    for (const id of assetIds) {
      await syncAssetSidecarFromDb(database, id)
    }
    return true
  })

  /** @deprecated Use assets:add-to-folders ??? kept for compatibility; adds to folder without removing others */
  ipc.handle('assets:move', async (_event, ids: string[], targetFolderId: string) => {
    assertStringArray('ids', ids)
    assertString('targetFolderId', targetFolderId)
    const database = getDatabase()
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
    return true
  })

  ipc.handle('assets:update-metadata', async (_event, id: string, metadata: Record<string, unknown>) => {
    assertString('id', id)
    assertPlainObject('metadata', metadata)
    const database = getDatabase()
    await database
      .update(assets)
      .set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
      .where(eq(assets.id, id))
    await syncAssetSidecarFromDb(database, id)
    return true
  })

  ipc.handle('assets:update-notes', async (_event, id: string, notes: unknown) => {
    assertString('id', id)
    return updateAssetNotes(id, notes)
  })

  ipc.handle('assets:update-source-url', async (_event, id: string, url: unknown) => {
    assertString('id', id)
    return updateAssetSourceUrl(id, url)
  })

  ipc.handle('assets:rename', async (_event, id: string, newName: string) => {
    assertString('id', id)
    assertString('newName', newName)
    return renameAsset(id, newName)
  })

  ipc.handle('assets:analyze-colors-batch', async (_event, ids: string[]) => {
    assertStringArray('ids', ids)
    const database = getDatabase()
    let updated = 0
    for (const id of ids) {
      const asset = await database.select().from(assets).where(eq(assets.id, id)).get()
      if (!asset) continue
      const absFile = resolveAssetContentPath(asset)
      const absThumb = resolveThumbPathForColorAnalysis(asset)
      const result = await analyzeColorsFromFile(absFile, asset.fileType, absThumb, id)
      if (!result) continue
      await persistAssetColorAnalysis(database, id, result)
      updated++
    }

    return { updated }
  })

  ipc.handle('assets:copy-to-library', async (_event, assetIds: string[], targetLibraryRoot: string) => {
    assertStringArray('assetIds', assetIds)
    assertString('targetLibraryRoot', targetLibraryRoot)
    return copyAssetsToOtherLibrary(assetIds, targetLibraryRoot)
  })

  ipc.handle('assets:analyze-colors', async (_event, id: string) => {
    assertString('id', id)
    const database = getDatabase()
    const asset = await database.select().from(assets).where(eq(assets.id, id)).get()
    if (!asset) return null
    if (asset.fileType !== 'image' && asset.fileType !== 'video') return null

    const absFile = resolveAssetContentPath(asset)
    const absThumb = resolveThumbPathForColorAnalysis(asset)
    const result = await analyzeColorsFromFile(absFile, asset.fileType, absThumb, id)
    if (!result) return null

    await persistAssetColorAnalysis(database, id, result)

    return { dominantColor: result.dominantColor, colors: result.colors }
  })

  ipc.handle('assets:localize', async (_event, assetIds: string[]) => {
    assertStringArray('assetIds', assetIds)
    const { localizeAssets } = await import('../../services/localizeAsset')
    return localizeAssets(assetIds, { preferHardlink: true })
  })

  ipc.handle('assets:relink', async (_event, assetId: string, newPath: string) => {
    const { relinkAssetSource } = await import('../../services/libraryUpgrade')
    if (typeof assetId !== 'string' || typeof newPath !== 'string') {
      return { ok: false as const, error: '???????????' }
    }
    return relinkAssetSource(assetId, newPath)
  })

  ipc.handle('assets:get-thumbnail', async (_event, id: string) => {
    assertString('id', id)
    const database = getDatabase()
    const asset = await database
      .select({
        id: assets.id,
        filePath: assets.filePath,
        storageMode: assets.storageMode,
        fileType: assets.fileType,
        extension: assets.extension,
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

    const absFile = asset.filePath ? resolveAssetContentPath(asset) : ''

    if (isCustomThumbnail(asset.id)) {
      const fromCustom = readWebpDataUrl(itemThumbRelative(asset.id))
      if (fromCustom) return fromCustom
    }

    if (
      asset.fileType === 'image' &&
      absFile &&
      existsSync(absFile) &&
      shouldUseOriginalImageDimensions(asset.width, asset.height) &&
      asset.extension?.toLowerCase() !== '.exr'
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
      const gen = await getThumbnailService().generate(
        absFile,
        asset.id,
        getThumbnailService().getGenerationDefaults()
      )
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
          const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
          return `data:image/webp;base64,${buf.toString('base64')}`
        }
        // EXR 不能直接作为原始位图直出给浏览器，否则会解析失败。
        if (asset.extension?.toLowerCase() === '.exr') return null
        return bufferToImageDataUrl(gen.buffer, asset.mimeType || 'image/jpeg')
      }
    }

    if (asset.fileType === 'video' && absFile && existsSync(absFile)) {
      const gen = await getThumbnailService().generateVideo(
        absFile,
        asset.id,
        getThumbnailService().getGenerationDefaults()
      )
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
        const buf = Buffer.isBuffer(gen.buffer) ? gen.buffer : Buffer.from(gen.buffer as ArrayLike<number>)
        return `data:image/webp;base64,${buf.toString('base64')}`
      }
    }

    if (asset.fileType === '3d' && absFile && existsSync(absFile)) {
      const ext = asset.extension || asset.filePath.split('.').pop() || ''
      if (!isModel3dPreviewExtension(ext)) return null

      const relThumb = itemThumbRelative(asset.id)
      const absThumb = resolveLibraryPath(relThumb)

      if (existsSync(absThumb)) {
        const fromDisk = readWebpDataUrl(relThumb)
        if (fromDisk) {
          if (!asset.hasThumbnail || asset.thumbnailPath !== relThumb) {
            await database
              .update(assets)
              .set({
                thumbnailPath: relThumb,
                hasThumbnail: true,
                updatedAt: new Date()
              })
              .where(eq(assets.id, id))
          }
          return fromDisk
        }
      }

      clearModelThumbnailSkip(asset.id)
      await waitForModelSnapshotBridge(90_000)
      const gen = await getThumbnailService().generateModel(absFile, asset.id, ext, {
        ...getThumbnailService().getGenerationDefaults(),
        force: true
      })
      if (gen?.buffer?.length) {
        await database
          .update(assets)
          .set({
            thumbnailPath: relThumb,
            hasThumbnail: true,
            updatedAt: new Date()
          })
          .where(eq(assets.id, id))
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

  ipc.handle('assets:regenerate-model-thumbnails', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const database = getDatabase()
    if (!database) {
      return { scanned: 0, updated: 0, skipped: 0, errors: 0, failures: [] }
    }

    const result = await regenerateModelThumbnails(database, (data) => {
      try {
        win?.webContents.send('model-thumb:regenerate-progress', data)
      } catch {
        /* window gone */
      }
    })

    await flushDatabase()
    return result
  })

  ipc.handle('assets:set-custom-thumbnail-file', async (_event, id: string, sourcePath: string) => {
    assertString('id', id)
    assertString('sourcePath', sourcePath)
    const database = getDatabase()
    if (!database) throw new Error('Database not ready')
    if (!sourcePath?.trim()) throw new Error('请提供有效的缩略图源文件路径')
    await setCustomThumbnailFromFile(database, id, sourcePath)
    return { ok: true as const }
  })

  ipc.handle('assets:set-custom-thumbnail-clipboard', async (_event, id: string) => {
    assertString('id', id)
    const database = getDatabase()
    if (!database) throw new Error('Database not ready')
    await setCustomThumbnailFromClipboard(database, id)
    return { ok: true as const }
  })

  ipc.handle('assets:refresh-thumbnail', async (_event, ids: string[]) => {
    assertStringArray('ids', ids)
    const database = getDatabase()
    if (!database) throw new Error('Database not ready')
    let updated = 0
    for (const id of ids) {
      if (await refreshAssetThumbnail(database, id)) updated++
    }
    await flushDatabase()
    return { updated, total: ids.length }
  })
}
