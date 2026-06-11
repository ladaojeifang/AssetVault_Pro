import type { SqliteDatabase } from '../db/sqliteTypes'
import { existsSync } from 'fs'
import { normalize } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { BrowserWindow } from 'electron'
import { getDatabase, flushDatabase, withSqliteTransaction } from '../db'
import { assets } from '../db/schema'
import { getLibraryRoot } from './libraryBundle'
import { getLibraryMode } from './libraryManifest'
import { findAssetIdByContentHash } from './contentHashService'
import { computeFileSha256 } from '../utils/contentHash'
import { toCanonicalFilePath } from '../utils/pathUtils'
import { notifyAllWindowsAssetsImported } from './importNotify'
import { localizeAssetFromSource } from './localizeAsset'
import {
  assertValidLibraryRoot,
  applySourceFolders,
  applySourceTagsAndLibraryTag,
  classifySourceAsset,
  emitImportProgress,
  insertLocalAssetFromSourcePack,
  isTargetAssetLocalInLibrary,
  loadSourceAssets,
  mergeAssetMetadata,
  openSourceLibraryDb,
  phaseFolders,
  phaseTags,
  readSourceDisplayName,
  readSourceLibraryMode,
  readSourceSidecarContentHash,
  refreshFolderAssetCounts,
  resolveSourceContentAbs,
  sourceAssetPackDir,
  tsToDate,
  type ProgressFn,
  type SourceAssetRow
} from './importLibraryShared'
import type { ImportLibraryResult, ImportLibrarySuccess } from '@/shared/libraryTypes'

type CatalogImportStats = {
  foldersCreated: number
  foldersMerged: number
  tagsCreated: number
  tagsMerged: number
  assetsAdded: number
  assetsSkippedDuplicate: number
  assetsFailed: number
  assetsAddedLocal: number
  assetsAddedReferenced: number
  assetsLocalizedOnImport: number
  assetsSkippedDuplicateLocal: number
  errors: ImportLibrarySuccess['errors']
}

async function insertReferencedAssetFromSource(
  targetDb: ReturnType<typeof getDatabase>,
  sourceRow: SourceAssetRow,
  contentHash: string,
  contentAbs: string
): Promise<string> {
  const newId = uuidv4()
  const canonical = toCanonicalFilePath(contentAbs)
  const now = new Date()
  const ext = sourceRow.extension.replace(/^\./, '').toLowerCase()
  const importSource = sourceRow.import_source?.trim() || canonical

  await targetDb.insert(assets).values({
    id: newId,
    filename: sourceRow.filename,
    originalName: sourceRow.original_name,
    extension: ext,
    mimeType: sourceRow.mime_type,
    fileType: sourceRow.file_type,
    folderId: null,
    filePath: canonical,
    storageMode: 'referenced',
    localizationState: 'idle',
    importSource: importSource,
    fileSize: sourceRow.file_size,
    contentHash,
    contentHashComputedAt: tsToDate(sourceRow.content_hash_computed_at) ?? now,
    width: sourceRow.width,
    height: sourceRow.height,
    dominantColor: sourceRow.dominant_color,
    colors: sourceRow.colors,
    duration: sourceRow.duration,
    thumbnailPath: null,
    hasThumbnail: false,
    metadata: sourceRow.metadata,
    notes: sourceRow.notes,
    sourceUrl: sourceRow.source_url,
    fileCreatedAt: tsToDate(sourceRow.file_created_at),
    fileModifiedAt: tsToDate(sourceRow.file_modified_at),
    importedAt: now,
    updatedAt: now
  } as any)

  return newId
}

async function processLocalizedAsset(
  targetDb: ReturnType<typeof getDatabase>,
  targetRoot: string,
  sourceRoot: string,
  sourceDb: SqliteDatabase,
  row: SourceAssetRow,
  contentHash: string,
  contentAbs: string,
  folderMap: Map<string, string>,
  tagMap: Map<string, string>,
  sourceLibraryTagId: string,
  stats: CatalogImportStats
) {
  const packDir = sourceAssetPackDir(sourceRoot, row.id)
  const existingId = await findAssetIdByContentHash(targetDb, row.file_size, contentHash)

  if (!existingId) {
    if (!existsSync(packDir)) {
      stats.assetsFailed++
      stats.errors.push({
        sourceAssetId: row.id,
        filename: row.filename,
        reason: 'A 侧 items pack 不存在，无法新建本地副本'
      })
      return
    }
    const newId = await insertLocalAssetFromSourcePack(
      targetDb,
      targetRoot,
      sourceRoot,
      row,
      contentHash,
      contentAbs
    )
    await applySourceFolders(targetDb, newId, row, folderMap, sourceDb)
    await applySourceTagsAndLibraryTag(targetDb, newId, row.id, sourceDb, tagMap, sourceLibraryTagId)
    stats.assetsAdded++
    stats.assetsAddedLocal++
    return
  }

  const bLocal = await isTargetAssetLocalInLibrary(targetDb, existingId, targetRoot)
  if (bLocal) {
    await mergeAssetMetadata(targetDb, existingId, row, folderMap, tagMap, sourceLibraryTagId, sourceDb)
    stats.assetsSkippedDuplicate++
    stats.assetsSkippedDuplicateLocal++
    return
  }

  if (!existsSync(packDir)) {
    stats.assetsFailed++
    stats.errors.push({
      sourceAssetId: row.id,
      filename: row.filename,
      reason: 'A 侧 items pack 不存在，无法本地化 B 中引用'
    })
    return
  }

  const mainInPack = resolveSourceContentAbs(sourceRoot, row)
  if (!mainInPack) {
    stats.assetsFailed++
    stats.errors.push({
      sourceAssetId: row.id,
      filename: row.filename,
      reason: 'A 侧 items pack 不可用，无法本地化 B 中引用'
    })
    return
  }

  const localized = await localizeAssetFromSource(existingId, mainInPack, {
    sourcePackDir: packDir,
    preferHardlink: false
  })
  if (!localized.ok) {
    stats.assetsFailed++
    stats.errors.push({
      sourceAssetId: row.id,
      filename: row.filename,
      reason: localized.reason
    })
    return
  }

  await mergeAssetMetadata(targetDb, existingId, row, folderMap, tagMap, sourceLibraryTagId, sourceDb)
  stats.assetsLocalizedOnImport++
  stats.assetsSkippedDuplicate++
}

async function processReferencedAsset(
  targetDb: ReturnType<typeof getDatabase>,
  sourceDb: SqliteDatabase,
  row: SourceAssetRow,
  contentHash: string,
  contentAbs: string,
  folderMap: Map<string, string>,
  tagMap: Map<string, string>,
  sourceLibraryTagId: string,
  stats: CatalogImportStats
) {
  const existingId = await findAssetIdByContentHash(targetDb, row.file_size, contentHash)
  if (existingId) {
    await mergeAssetMetadata(targetDb, existingId, row, folderMap, tagMap, sourceLibraryTagId, sourceDb)
    stats.assetsSkippedDuplicate++
    return
  }

  const newId = await insertReferencedAssetFromSource(targetDb, row, contentHash, contentAbs)
  await applySourceFolders(targetDb, newId, row, folderMap, sourceDb)
  await applySourceTagsAndLibraryTag(targetDb, newId, row.id, sourceDb, tagMap, sourceLibraryTagId)
  stats.assetsAdded++
  stats.assetsAddedReferenced++
}

export async function importCatalogToCatalogFromPath(
  sourceLibraryRoot: string,
  options?: { onProgress?: ProgressFn; win?: BrowserWindow }
): Promise<ImportLibraryResult> {
  const onProgress = options?.onProgress
  const win = options?.win

  emitImportProgress(onProgress, win, {
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
  const { sourceRoot, sourceDbPath } = base

  const sourceMode = readSourceLibraryMode(sourceRoot)
  if (sourceMode !== 'catalog') {
    return { ok: false, error: '源库须为索引库（catalog）', code: 'INVALID_SOURCE_MODE' }
  }
  if (getLibraryMode() !== 'catalog') {
    return { ok: false, error: '当前资料库须为索引库才能合并索引库', code: 'TARGET_NOT_CATALOG' }
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

  const stats: CatalogImportStats = {
    foldersCreated: 0,
    foldersMerged: 0,
    tagsCreated: 0,
    tagsMerged: 0,
    assetsAdded: 0,
    assetsSkippedDuplicate: 0,
    assetsFailed: 0,
    assetsAddedLocal: 0,
    assetsAddedReferenced: 0,
    assetsLocalizedOnImport: 0,
    assetsSkippedDuplicateLocal: 0,
    errors: []
  }

  try {
    emitImportProgress(onProgress, win, { phase: 'tags', current: 0, total: 1, filename: '', status: 'processing' })
    const { tagMap, sourceLibraryTagId, folderMap } = await withSqliteTransaction(async () => {
      const tagsResult = await phaseTags(sourceDb, targetDb, sourceLibraryTagName, stats)
      emitImportProgress(onProgress, win, { phase: 'folders', current: 0, total: 1, filename: '', status: 'processing' })
      const folderMapResult = await phaseFolders(sourceDb, targetDb, stats)
      return { tagMap: tagsResult.tagMap, sourceLibraryTagId: tagsResult.sourceLibraryTagId, folderMap: folderMapResult }
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
        const kind = classifySourceAsset(sourceRoot, row)
        if (kind === 'M') {
          stats.assetsFailed++
          stats.errors.push({
            sourceAssetId: row.id,
            filename: row.filename,
            reason: '找不到源文件'
          })
          continue
        }

        const contentAbs = resolveSourceContentAbs(sourceRoot, row)!
        let contentHash = row.content_hash ?? readSourceSidecarContentHash(sourceRoot, row.id)
        if (!contentHash) {
          contentHash = await computeFileSha256(contentAbs)
        }

        if (kind === 'L') {
          await withSqliteTransaction(async () => {
            await processLocalizedAsset(
              targetDb,
              targetRoot,
              sourceRoot,
              sourceDb,
              row,
              contentHash,
              contentAbs,
              folderMap,
              tagMap,
              sourceLibraryTagId,
              stats
            )
          })
        } else {
          await withSqliteTransaction(async () => {
            await processReferencedAsset(
              targetDb,
              sourceDb,
              row,
              contentHash,
              contentAbs,
              folderMap,
              tagMap,
              sourceLibraryTagId,
              stats
            )
          })
        }
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
      importMode: 'catalog_to_catalog_same_machine',
      sourceDisplayName,
      sourceLibraryRoot: sourceRoot,
      assetsAdded: stats.assetsAdded,
      assetsSkippedDuplicate: stats.assetsSkippedDuplicate,
      assetsFailed: stats.assetsFailed,
      foldersCreated: stats.foldersCreated,
      foldersMerged: stats.foldersMerged,
      tagsCreated: stats.tagsCreated,
      tagsMerged: stats.tagsMerged,
      sourceLibraryTagName,
      assetsAddedLocal: stats.assetsAddedLocal,
      assetsAddedReferenced: stats.assetsAddedReferenced,
      assetsLocalizedOnImport: stats.assetsLocalizedOnImport,
      assetsSkippedDuplicateLocal: stats.assetsSkippedDuplicateLocal,
      errors: stats.errors
    }
  } finally {
    sourceDb.close()
  }
}
