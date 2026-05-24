import { eq } from 'drizzle-orm'
import { existsSync } from 'fs'
import { db, persistDatabase } from '../db'
import { assets } from '../db/schema'
import { resolveLibraryPath, itemThumbRelative } from './libraryBundle'
import { getThumbnailService } from './ThumbnailService'
import { isModelThumbnailSkipped, markModelThumbnailSkipped, clearModelThumbnailSkip } from './modelThumbnailSkip'
import { syncAssetSidecarFromDb } from './assetSidecar'
import type { ModelRegenerateFailure, ModelRegenerateResult } from '@/shared/model3dFormats'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import { isCustomThumbnail } from './customThumbnail'
import { waitForModelSnapshotBridge } from './modelThumbnailRenderer'
import { notifyAllWindowsAssetsImported } from './importNotify'

export { notifyAllWindowsAssetsImported }

type Database = NonNullable<typeof db>

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Generate 3D thumb after import; updates DB + meta.json when done. */
export async function schedule3dThumbnailAfterImport(
  database: Database,
  assetId: string,
  destAbs: string,
  extNoDot: string
): Promise<void> {
  if (!isModel3dPreviewExtension(extNoDot)) return
  if (isCustomThumbnail(assetId)) return

  const absThumb = resolveLibraryPath(itemThumbRelative(assetId))
  if (existsSync(absThumb)) {
    try {
      await database
        .update(assets)
        .set({
          thumbnailPath: itemThumbRelative(assetId),
          hasThumbnail: true,
          updatedAt: new Date()
        })
        .where(eq(assets.id, assetId))
      await syncAssetSidecarFromDb(database, assetId)
      persistDatabase()
      notifyAllWindowsAssetsImported()
    } catch (error) {
      console.warn('[Import] 3D thumbnail DB sync failed:', error)
    }
    return
  }

  clearModelThumbnailSkip(assetId)

  const bridgeReady = await waitForModelSnapshotBridge(120_000)
  if (!bridgeReady) {
    console.warn(`[Import] snapshot bridge not ready; using hidden window for ${assetId}`)
  }

  let thumb = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt)
    thumb = await getThumbnailService().generateModel(destAbs, assetId, extNoDot, {
      width: 256,
      height: 256,
      quality: 80,
      force: true
    })
    if (thumb?.buffer?.length) break
  }

  if (!thumb?.buffer?.length) {
    markModelThumbnailSkipped(assetId, 'render failed after retries')
    console.warn(`[Import] 3D thumbnail failed for ${assetId}`)
    return
  }

  try {
    await database
      .update(assets)
      .set({
        thumbnailPath: itemThumbRelative(assetId),
        hasThumbnail: true,
        updatedAt: new Date()
      })
      .where(eq(assets.id, assetId))

    await syncAssetSidecarFromDb(database, assetId)
    persistDatabase()
    notifyAllWindowsAssetsImported()
  } catch (error) {
    console.warn('[Import] 3D thumbnail DB update failed:', error)
  }
}

/** On startup / library open: queue missing 3D thumbs (skips assets marked .thumb-failed). */
export async function processPending3dThumbnails(database: Database): Promise<void> {
  await waitForModelSnapshotBridge(120_000)

  const rows = await database.select().from(assets).where(eq(assets.fileType, '3d')).all()
  for (const row of rows) {
    if (!isModel3dPreviewExtension(row.extension)) continue
    if (isCustomThumbnail(row.id)) continue
    if (row.hasThumbnail && row.thumbnailPath) {
      const absThumb = resolveLibraryPath(row.thumbnailPath)
      if (existsSync(absThumb)) continue
    }
    const absThumbPath = resolveLibraryPath(itemThumbRelative(row.id))
    if (isModelThumbnailSkipped(row.id) && !existsSync(absThumbPath)) {
      clearModelThumbnailSkip(row.id)
    } else if (isModelThumbnailSkipped(row.id)) {
      continue
    }

    const absFile = row.filePath ? resolveLibraryPath(row.filePath) : ''
    if (!absFile || !existsSync(absFile)) continue

    void schedule3dThumbnailAfterImport(database, row.id, absFile, row.extension)
  }
}

export async function regenerateModelThumbnails(
  database: Database,
  onProgress?: (data: { current: number; total: number; assetId: string; status: 'processing' | 'done' | 'error' }) => void
): Promise<ModelRegenerateResult> {
  const rows = await database.select().from(assets).where(eq(assets.fileType, '3d')).all()
  const total = rows.length
  let updated = 0
  let skipped = 0
  let errors = 0
  const failures: ModelRegenerateFailure[] = []
  const thumbService = getThumbnailService()

  await waitForModelSnapshotBridge(120_000)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress?.({ current: i + 1, total, assetId: row.id, status: 'processing' })

    const absFile = row.filePath ? resolveLibraryPath(row.filePath) : ''
    if (!absFile || !existsSync(absFile)) {
      errors++
      failures.push({ assetId: row.id, filename: row.filename, reason: '模型文件不存在' })
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
      continue
    }

    if (!isModel3dPreviewExtension(row.extension)) {
      skipped++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
      continue
    }

    if (isCustomThumbnail(row.id)) {
      skipped++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
      continue
    }

    clearModelThumbnailSkip(row.id)
    thumbService.invalidate(row.id)

    try {
      const thumb = await thumbService.generateModel(absFile, row.id, row.extension, {
        width: 256,
        height: 256,
        quality: 80,
        force: true
      })

      if (!thumb?.buffer?.length) {
        markModelThumbnailSkipped(row.id, 'regenerate render failed')
        errors++
        failures.push({ assetId: row.id, filename: row.filename, reason: '缩略图渲染失败' })
        onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
        continue
      }

      await database
        .update(assets)
        .set({
          thumbnailPath: itemThumbRelative(row.id),
          hasThumbnail: true,
          updatedAt: new Date()
        })
        .where(eq(assets.id, row.id))

      await syncAssetSidecarFromDb(database, row.id)
      updated++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
    } catch (e) {
      errors++
      failures.push({
        assetId: row.id,
        filename: row.filename,
        reason: e instanceof Error ? e.message : String(e)
      })
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
    }
  }

  if (updated > 0) persistDatabase()
  if (updated > 0) notifyAllWindowsAssetsImported()

  return { scanned: total, updated, skipped, errors, failures }
}
