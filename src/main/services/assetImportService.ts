import { existsSync, statSync, readdirSync } from 'fs'
import { join, extname, dirname } from 'path'
import { flushDatabase } from '../db'
import type { ImportAssetOptions } from '@/shared/importTypes'
import type {
  AssetImportBatchResponse,
  AssetImportFolderResponse,
  AssetImportResult
} from '@/shared/webApiTypes'
import { importSingleAsset } from './importSingleAsset'
import { getFileWatcher } from './FileWatcher'
import { isAutoWatchFoldersEnabled } from './appPreferencesStore'
import { notifyAllWindowsAssetsImported } from './importNotify'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { eq } from 'drizzle-orm'
import { toCanonicalFilePath } from '../utils/pathUtils'

export type ApiImportOptions = ImportAssetOptions & {
  /** API default: use_existing (no UI prompt). */
  duplicatePolicy?: 'ask' | 'use_existing' | 'import_copy'
}

function buildImportOpts(options?: ApiImportOptions) {
  return {
    targetFolderId: options?.targetFolderId,
    duplicatePolicy: options?.duplicatePolicy ?? 'use_existing',
    presetAssetId: options?.presetAssetId,
    skipCopyIntoPack: options?.skipCopyIntoPack,
    skipTextPreviewThumbnail: options?.skipTextPreviewThumbnail
  }
}

function afterImportFile(filePath: string): void {
  if (isAutoWatchFoldersEnabled()) {
    try {
      getFileWatcher().watch(dirname(filePath))
    } catch (e) {
      console.warn('[Import] watch:', e)
    }
  }
  notifyAllWindowsAssetsImported()
}

export async function importAssetFromPath(
  filePath: string,
  options?: ApiImportOptions
): Promise<AssetImportResult> {
  if (!existsSync(filePath)) {
    throw new Error('FILE_NOT_FOUND')
  }
  const stat = statSync(filePath)
  if (!stat.isFile()) {
    throw new Error('FILE_NOT_FILE')
  }

  const canonical = toCanonicalFilePath(filePath)
  const database = getDatabase()
  const existing = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.importSource, canonical))
    .get()

  const assetId = await importSingleAsset(filePath, buildImportOpts(options))

  if (!assetId) {
    if (existing) {
      return {
        skipped: true,
        reason: 'duplicate_source',
        existingAssetId: existing.id
      }
    }
    return { skipped: true, reason: 'cancelled_or_failed' }
  }

  if (existing && existing.id === assetId) {
    return { skipped: true, reason: 'duplicate_source', existingAssetId: assetId, assetId }
  }

  afterImportFile(filePath)
  await flushDatabase()
  return { skipped: false, assetId }
}

export async function importAssetFiles(
  filePaths: string[],
  options?: ApiImportOptions
): Promise<AssetImportBatchResponse> {
  const imported: string[] = []
  const skipped: AssetImportBatchResponse['skipped'] = []
  const errors: AssetImportBatchResponse['errors'] = []

  for (const filePath of filePaths) {
    try {
      const result = await importAssetFromPath(filePath, options)
      if (result.skipped) {
        skipped.push({
          filePath,
          reason: result.reason ?? 'skipped',
          existingAssetId: result.existingAssetId
        })
      } else if (result.assetId) {
        imported.push(result.assetId)
      }
    } catch (e) {
      const code = e instanceof Error && e.message === 'FILE_NOT_FOUND' ? 'file_not_found' : 'error'
      if (code === 'file_not_found') {
        errors.push({ filePath, message: '路径不存在' })
      } else if (e instanceof Error && e.message === 'FILE_NOT_FILE') {
        errors.push({ filePath, message: '不是文件' })
      } else {
        errors.push({
          filePath,
          message: e instanceof Error ? e.message : String(e)
        })
      }
    }
  }

  await flushDatabase()
  notifyAllWindowsAssetsImported()
  return { imported, skipped, errors }
}

function scanImportDir(dir: string): string[] {
  const supportedExts = ALL_SUPPORTED_IMPORT_EXTENSIONS
  const results: string[] = []

  function scan(current: string): void {
    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (supportedExts.has(extname(entry.name).toLowerCase())) {
        results.push(fullPath)
      }
    }
  }

  scan(dir)
  return results
}

export async function importAssetFolder(
  folderPath: string,
  options?: ApiImportOptions
): Promise<AssetImportFolderResponse> {
  if (!existsSync(folderPath)) {
    throw new Error('FILE_NOT_FOUND')
  }
  if (!statSync(folderPath).isDirectory()) {
    throw new Error('FILE_NOT_DIRECTORY')
  }

  const allFiles = scanImportDir(folderPath)
  const batch = await importAssetFiles(allFiles, options)
  return {
    imported: batch.imported,
    totalFiles: allFiles.length,
    errors: batch.errors
  }
}
