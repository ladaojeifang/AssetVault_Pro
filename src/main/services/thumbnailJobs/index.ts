import type { ModelRegenerateResult } from '@/shared/model3dFormats'
import type { EmbeddedDccRegenerateResult } from '@/shared/embeddedDccFormats'
import type { TextPreviewRegenerateResult } from '@/shared/textPreviewFormats'
import {
  ASYNC_THUMBNAIL_JOBS,
  embeddedDccThumbnailJob,
  model3dThumbnailJob,
  resolveAsyncThumbnailJob,
  textPreviewThumbnailJob
} from './definitions'
import {
  processPendingForJob,
  regenerateForJob,
  runThumbnailJobForAsset,
  scheduleAsyncThumbnailAfterImport
} from './runner'
import type { Database, ThumbJobProgress } from './types'

export {
  ASYNC_THUMBNAIL_JOBS,
  resolveAsyncThumbnailJob,
  model3dThumbnailJob,
  embeddedDccThumbnailJob,
  textPreviewThumbnailJob,
  scheduleAsyncThumbnailAfterImport,
  runThumbnailJobForAsset
}

/** After import: pick job by extension and enqueue. */
export function scheduleDeferredThumbnailAfterImport(
  database: Database,
  assetId: string,
  absFile: string,
  extNoDot: string
): void {
  const job = resolveAsyncThumbnailJob(extNoDot)
  if (!job) return
  scheduleAsyncThumbnailAfterImport(database, assetId, absFile, extNoDot, job)
}

export async function processAllPendingAsyncThumbnails(database: Database): Promise<void> {
  for (const job of ASYNC_THUMBNAIL_JOBS) {
    await processPendingForJob(database, job)
  }
}

// --- Backward-compatible exports (IPC / legacy imports) ---

export async function processPending3dThumbnails(database: Database): Promise<void> {
  await processPendingForJob(database, model3dThumbnailJob)
}

export async function processPendingEmbeddedDccThumbnails(database: Database): Promise<void> {
  await processPendingForJob(database, embeddedDccThumbnailJob)
}

export async function processPendingTextPreviewThumbnails(database: Database): Promise<void> {
  await processPendingForJob(database, textPreviewThumbnailJob)
}

export function schedule3dThumbnailAfterImport(
  database: Database,
  assetId: string,
  destAbs: string,
  extNoDot: string
): void {
  scheduleAsyncThumbnailAfterImport(database, assetId, destAbs, extNoDot, model3dThumbnailJob)
}

export function scheduleEmbeddedDccThumbnailAfterImport(
  database: Database,
  assetId: string,
  destAbs: string,
  extNoDot: string
): void {
  scheduleAsyncThumbnailAfterImport(database, assetId, destAbs, extNoDot, embeddedDccThumbnailJob)
}

export function scheduleTextPreviewThumbnailAfterImport(
  database: Database,
  assetId: string,
  destAbs: string,
  extNoDot: string,
  _fileType?: string
): void {
  scheduleAsyncThumbnailAfterImport(database, assetId, destAbs, extNoDot, textPreviewThumbnailJob)
}

export async function regenerateModelThumbnails(
  database: Database,
  onProgress?: (data: ThumbJobProgress) => void
): Promise<ModelRegenerateResult> {
  return regenerateForJob(database, model3dThumbnailJob, onProgress)
}

export async function regenerateEmbeddedDccThumbnails(
  database: Database,
  onProgress?: (data: ThumbJobProgress) => void
): Promise<EmbeddedDccRegenerateResult> {
  return regenerateForJob(database, embeddedDccThumbnailJob, onProgress)
}

export async function regenerateTextPreviewThumbnails(
  database: Database,
  onProgress?: (data: ThumbJobProgress) => void
): Promise<TextPreviewRegenerateResult> {
  return regenerateForJob(database, textPreviewThumbnailJob, onProgress)
}

export { notifyAllWindowsAssetsImported } from '../importNotify'
