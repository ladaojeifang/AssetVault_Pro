import type { SqliteDatabase } from '../db/sqliteTypes'
import { existsSync } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import { getDatabase, flushDatabase, withSqliteTransaction } from '../db'
import { getLibraryRoot, ITEMS_DIR } from './libraryBundle'
import { getLibraryMode, readLibraryManifestFile } from './libraryManifest'
import { findAssetIdByContentHash } from './contentHashService'
import { computeFileSha256 } from '../utils/contentHash'
import { notifyAllWindowsAssetsImported } from './importNotify'
import { importCatalogToCatalogFromPath } from './importCatalogToCatalogFromPath'
import {
  assertValidLibraryRoot,
  applySourceFolders,
  applySourceTagsAndLibraryTag,
  emitImportProgress,
  insertLocalAssetFromSourcePack,
  loadSourceAssets,
  mergeAssetMetadata,
  openSourceLibraryDb,
  phaseFolders,
  phaseCategories,
  phaseTags,
  readSourceDisplayName,
  readSourceLibraryMode,
  readSourceSidecarContentHash,
  refreshFolderAssetCounts,
  resolveSourceContentAbs,
  type BaseImportStats,
  type ProgressFn
} from './importLibraryShared'
import type { ImportLibraryResult } from '@/shared/libraryTypes'

let importInProgress = false

async function importArchiveToArchiveFromPath(
  sourceLibraryRoot: string,
  options?: { onProgress?: ProgressFn; win?: BrowserWindow }
): Promise<ImportLibraryResult> {
  const onProgress = options?.onProgress
  const win = options?.win

  const base = assertValidLibraryRoot(sourceLibraryRoot)
  if (!base.ok) {
    return { ok: false, error: base.error, code: base.code }
  }
  const { sourceRoot, sourceDbPath } = base

  const manifest = readLibraryManifestFile(sourceRoot)
  if (!manifest || manifest.libraryMode !== 'archive') {
    return { ok: false, error: '仅支持从完整库（archive）导入', code: 'INVALID_SOURCE_MODE' }
  }
  if (getLibraryMode() !== 'archive') {
    return { ok: false, error: '请先将当前资料库设为完整库后再导入', code: 'TARGET_NOT_ARCHIVE' }
  }

  const sourceDisplayName = readSourceDisplayName(sourceRoot)
  const sourceLibraryTagName = sourceDisplayName
  const targetDb = getDatabase()
  const targetRoot = getLibraryRoot()

  let sourceDb: SqliteDatabase
  try {
    sourceDb = openSourceLibraryDb(sourceDbPath)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '无法打开源资料库数据库',
      code: 'SOURCE_DB_ERROR'
    }
  }

  const stats: BaseImportStats = {
    foldersCreated: 0,
    foldersMerged: 0,
    tagsCreated: 0,
    tagsMerged: 0,
    categoriesCreated: 0,
    categoriesMerged: 0,
    assetsAdded: 0,
    assetsSkippedDuplicate: 0,
    assetsFailed: 0,
    errors: []
  }

  try {
    emitImportProgress(onProgress, win, { phase: 'tags', current: 0, total: 1, filename: '', status: 'processing' })
    const { tagMap, sourceLibraryTagId, folderMap, categoryMap } = await withSqliteTransaction(async () => {
      const tagsResult = await phaseTags(sourceDb, targetDb, sourceLibraryTagName, stats)
      const categoryMapResult = await phaseCategories(sourceDb, targetDb, stats)
      emitImportProgress(onProgress, win, { phase: 'folders', current: 0, total: 1, filename: '', status: 'processing' })
      const folderMapResult = await phaseFolders(sourceDb, targetDb, stats)
      return {
        tagMap: tagsResult.tagMap,
        sourceLibraryTagId: tagsResult.sourceLibraryTagId,
        folderMap: folderMapResult,
        categoryMap: categoryMapResult
      }
    })

    const sourceAssets = loadSourceAssets(sourceDb)
    const total = sourceAssets.length

    emitImportProgress(onProgress, win, {
      phase: 'assets',
      current: 0,
      total,
      filename: '',
      status: 'processing'
    })

    for (let i = 0; i < sourceAssets.length; i++) {
      const row = sourceAssets[i]!
      emitImportProgress(onProgress, win, {
        phase: 'assets',
        current: i + 1,
        total,
        filename: row.filename,
        status: 'processing'
      })

      try {
        const itemDir = join(sourceRoot, ITEMS_DIR, row.id)
        if (!existsSync(itemDir)) {
          stats.assetsFailed++
          stats.errors.push({
            sourceAssetId: row.id,
            filename: row.filename,
            reason: 'items 目录不存在'
          })
          continue
        }

        const contentAbs = resolveSourceContentAbs(sourceRoot, row)
        if (!contentAbs) {
          stats.assetsFailed++
          stats.errors.push({
            sourceAssetId: row.id,
            filename: row.filename,
            reason: '找不到源文件'
          })
          continue
        }

        let contentHash = row.content_hash ?? readSourceSidecarContentHash(sourceRoot, row.id)
        if (!contentHash) {
          contentHash = await computeFileSha256(contentAbs)
        }

        const existingId = await findAssetIdByContentHash(targetDb, row.file_size, contentHash)
        if (existingId) {
          await withSqliteTransaction(async () => {
            await mergeAssetMetadata(
              targetDb,
              existingId,
              row,
              folderMap,
              tagMap,
              sourceLibraryTagId,
              sourceDb
            )
          })
          stats.assetsSkippedDuplicate++
          continue
        }

        await withSqliteTransaction(async () => {
          const newId = await insertLocalAssetFromSourcePack(
            targetDb,
            targetRoot,
            sourceRoot,
            row,
            contentHash,
            contentAbs,
            categoryMap,
            sourceDb
          )

          await applySourceFolders(targetDb, newId, row, folderMap, sourceDb)
          await applySourceTagsAndLibraryTag(
            targetDb,
            newId,
            row.id,
            sourceDb,
            tagMap,
            sourceLibraryTagId
          )
        })

        stats.assetsAdded++
      } catch (e) {
        stats.assetsFailed++
        stats.errors.push({
          sourceAssetId: row.id,
          filename: row.filename,
          reason: e instanceof Error ? e.message : String(e)
        })
      }
    }

    emitImportProgress(onProgress, win, {
      phase: 'finalize',
      current: 1,
      total: 1,
      filename: '',
      status: 'processing'
    })
    await refreshFolderAssetCounts(targetDb)
    await flushDatabase()
    notifyAllWindowsAssetsImported()
    try {
      win?.webContents.send('library:import-complete')
    } catch {
      /* ignore */
    }

    emitImportProgress(onProgress, win, {
      phase: 'finalize',
      current: 1,
      total: 1,
      filename: '',
      status: 'done'
    })

    return {
      ok: true,
      importMode: 'archive_to_archive',
      sourceDisplayName,
      sourceLibraryRoot: sourceRoot,
      assetsAdded: stats.assetsAdded,
      assetsSkippedDuplicate: stats.assetsSkippedDuplicate,
      assetsFailed: stats.assetsFailed,
      foldersCreated: stats.foldersCreated,
      foldersMerged: stats.foldersMerged,
      tagsCreated: stats.tagsCreated,
      tagsMerged: stats.tagsMerged,
      categoriesCreated: stats.categoriesCreated,
      categoriesMerged: stats.categoriesMerged,
      sourceLibraryTagName,
      errors: stats.errors
    }
  } finally {
    sourceDb.close()
  }
}

export async function importLibraryFromPath(
  sourceLibraryRoot: string,
  options?: { onProgress?: ProgressFn; win?: BrowserWindow }
): Promise<ImportLibraryResult> {
  if (importInProgress) {
    return { ok: false, error: '已有资料库导入任务正在进行', code: 'LIBRARY_BUSY' }
  }

  importInProgress = true
  try {
    emitImportProgress(options?.onProgress, options?.win, {
      phase: 'validate',
      current: 0,
      total: 1,
      filename: '',
      status: 'processing'
    })

    const base = assertValidLibraryRoot(sourceLibraryRoot)
    if (!base.ok) {
      return { ok: false, error: base.error, code: base.code }
    }

    const sourceMode = readSourceLibraryMode(base.sourceRoot)
    const targetMode = getLibraryMode()

    if (sourceMode === 'catalog' && targetMode === 'catalog') {
      return importCatalogToCatalogFromPath(sourceLibraryRoot, options)
    }
    if (sourceMode === 'archive' && targetMode === 'archive') {
      return importArchiveToArchiveFromPath(sourceLibraryRoot, options)
    }
    if (sourceMode === 'archive' && targetMode === 'catalog') {
      return {
        ok: false,
        error: '完整库不能导入到索引库，请先将当前库转为完整库或切换目标库',
        code: 'TARGET_NOT_CATALOG'
      }
    }
    if (sourceMode === 'catalog' && targetMode === 'archive') {
      return {
        ok: false,
        error: '索引库不能导入到完整库，请使用两个索引库合并或先将源库转为完整库',
        code: 'INVALID_SOURCE_MODE'
      }
    }

    return { ok: false, error: '不支持的资料库模式组合', code: 'INVALID_SOURCE_MODE' }
  } finally {
    importInProgress = false
  }
}
