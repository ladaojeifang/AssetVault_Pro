import { eq } from 'drizzle-orm'
import { existsSync } from 'fs'
import { assets } from '../../db/schema'
import { resolveLibraryPath, itemThumbRelative } from '../libraryBundle'
import { resolveAssetContentPath } from '../assetPathResolver'
import { resolveExistingThumbnailRelPath } from '../thumbnailRead'
import { getThumbnailService } from '../ThumbnailService'
import {
  clearThumbnailSkip,
  isThumbnailSkippedForPipeline,
  markThumbnailSkipped
} from '../thumbnailSkip'
import type { ThumbSkipPipeline } from '../thumbnailSkip'
import { syncAssetSidecarFromDb } from '../assetSidecar'
import { isCustomThumbnail } from '../customThumbnail'
import { notifyAllWindowsAssetsImported } from '../importNotify'
import { tryAutoColorFromThumbnail } from '../persistAssetColors'
import { deferThumbnailWork } from '../thumbnailStartup'
import type {
  AssetThumbRow,
  AsyncThumbnailJob,
  Database,
  ThumbJobProgress,
  ThumbRegenerateResult
} from './types'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function syncExistingThumbPathToDb(
  database: Database,
  assetId: string,
  relPath: string
): Promise<void> {
  await database
    .update(assets)
    .set({
      thumbnailPath: relPath,
      hasThumbnail: true,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))
  await syncAssetSidecarFromDb(database, assetId)
  notifyAllWindowsAssetsImported()
}

async function persistGeneratedThumb(
  database: Database,
  assetId: string,
  extractColor: boolean
): Promise<void> {
  await database
    .update(assets)
    .set({
      thumbnailPath: itemThumbRelative(assetId),
      hasThumbnail: true,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  await syncAssetSidecarFromDb(database, assetId)
  if (extractColor) {
    void tryAutoColorFromThumbnail(database, assetId, resolveLibraryPath(itemThumbRelative(assetId)))
  }
  notifyAllWindowsAssetsImported()
}

function shouldProcessPendingRow(row: AssetThumbRow, job: AsyncThumbnailJob): boolean {
  if (isCustomThumbnail(row.id)) return false

  if (resolveExistingThumbnailRelPath(row.id, row.thumbnailPath)) return false

  const absThumbPath = resolveLibraryPath(itemThumbRelative(row.id))
  const pipeline = job.id as ThumbSkipPipeline
  if (isThumbnailSkippedForPipeline(row.id, pipeline) && !existsSync(absThumbPath)) {
    clearThumbnailSkip(row.id, pipeline)
  } else if (isThumbnailSkippedForPipeline(row.id, pipeline)) {
    return false
  }

  const absFile = row.filePath ? resolveAssetContentPath(row) : ''
  return Boolean(absFile && existsSync(absFile))
}

/** Generate thumb for one asset (import / pending backfill). */
export async function runThumbnailJobForAsset(
  database: Database,
  job: AsyncThumbnailJob,
  assetId: string,
  absFile: string,
  extNoDot: string
): Promise<void> {
  if (!job.matchesAsset(extNoDot)) return
  if (isCustomThumbnail(assetId)) return

  const row = await database
    .select({ thumbnailPath: assets.thumbnailPath })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get()
  const existingRel = resolveExistingThumbnailRelPath(assetId, row?.thumbnailPath)
  if (existingRel) {
    try {
      if (row?.thumbnailPath !== existingRel) {
        await syncExistingThumbPathToDb(database, assetId, existingRel)
      }
    } catch (error) {
      console.warn(`[${job.logTag}] thumbnail DB sync failed:`, error)
    }
    return
  }

  clearThumbnailSkip(assetId, job.id as ThumbSkipPipeline)
  if (job.beforeGenerate) {
    await job.beforeGenerate()
  }

  const thumbService = getThumbnailService()
  const opts = { ...thumbService.getGenerationDefaults(), force: true }
  let thumb = null

  for (let attempt = 0; attempt < job.maxAttempts; attempt++) {
    if (attempt > 0) await sleep(job.retryDelayMs(attempt))
    thumb = await job.generate(absFile, assetId, extNoDot, opts)
    if (thumb?.buffer?.length) break
  }

  if (!thumb?.buffer?.length) {
    markThumbnailSkipped(assetId, job.id as ThumbSkipPipeline, job.skipMarkReason)
    console.warn(`[${job.logTag}] thumbnail failed for ${assetId}`)
    return
  }

  try {
    await persistGeneratedThumb(database, assetId, job.extractColor ?? false)
  } catch (error) {
    console.warn(`[${job.logTag}] thumbnail DB update failed:`, error)
  }
}

/** Queue async thumb generation after import (respects startup defer gate). */
export function scheduleAsyncThumbnailAfterImport(
  database: Database,
  assetId: string,
  absFile: string,
  extNoDot: string,
  job: AsyncThumbnailJob
): void {
  if (!job.matchesAsset(extNoDot)) return
  deferThumbnailWork(() => runThumbnailJobForAsset(database, job, assetId, absFile, extNoDot))
}

export async function processPendingForJob(database: Database, job: AsyncThumbnailJob): Promise<void> {
  if (job.beforeBatch) {
    await job.beforeBatch()
  }

  const rows = await job.loadRows(database)
  for (const row of rows) {
    if (!job.matchesAsset(row.extension)) continue
    if (!shouldProcessPendingRow(row, job)) continue

    const absFile = row.filePath ? resolveAssetContentPath(row) : ''
    if (!absFile) continue

    await runThumbnailJobForAsset(database, job, row.id, absFile, row.extension)
  }
}

export async function regenerateForJob(
  database: Database,
  job: AsyncThumbnailJob,
  onProgress?: (data: ThumbJobProgress) => void
): Promise<ThumbRegenerateResult> {
  if (job.beforeBatch) {
    await job.beforeBatch()
  }

  const rows = await job.loadRows(database)
  const total = rows.length
  let updated = 0
  let skipped = 0
  let errors = 0
  const failures: ThumbRegenerateResult['failures'] = []
  const thumbService = getThumbnailService()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    onProgress?.({ current: i + 1, total, assetId: row.id, status: 'processing' })

    if (!job.rowsAreCandidatesOnly && !job.matchesAsset(row.extension)) {
      skipped++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
      continue
    }

    const absFile = row.filePath ? resolveAssetContentPath(row) : ''
    if (!absFile || !existsSync(absFile)) {
      errors++
      failures.push({ assetId: row.id, filename: row.filename, reason: 'source file missing' })
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
      continue
    }

    if (isCustomThumbnail(row.id)) {
      skipped++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
      continue
    }

    clearThumbnailSkip(row.id, job.id as ThumbSkipPipeline)
    thumbService.invalidate(row.id)

    try {
      const thumb = await job.generate(absFile, row.id, row.extension, {
        ...thumbService.getGenerationDefaults(),
        force: true
      })

      if (!thumb?.buffer?.length) {
        markThumbnailSkipped(row.id, job.id as ThumbSkipPipeline, job.skipMarkReason)
        errors++
        failures.push({
          assetId: row.id,
          filename: row.filename,
          reason: job.regenerateFailReason
        })
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

  if (updated > 0) notifyAllWindowsAssetsImported()

  return { scanned: total, updated, skipped, errors, failures }
}
