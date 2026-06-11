import { eq, or } from 'drizzle-orm'
import { assets } from '../../db/schema'
import { getThumbnailService } from '../ThumbnailService'
import { waitForModelSnapshotBridge } from '../modelThumbnailRenderer'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import { isEmbeddedDccThumbExtension } from '@/shared/embeddedDccFormats'
import { isTextPreviewExtension } from '@/shared/textPreviewFormats'
import type { AssetThumbRow, AsyncThumbnailJob, Database } from './types'

const ASSET_THUMB_COLUMNS = {
  id: assets.id,
  filename: assets.filename,
  extension: assets.extension,
  fileType: assets.fileType,
  filePath: assets.filePath,
  hasThumbnail: assets.hasThumbnail,
  thumbnailPath: assets.thumbnailPath
}

async function load3dRows(database: Database): Promise<AssetThumbRow[]> {
  return database.select(ASSET_THUMB_COLUMNS).from(assets).where(eq(assets.fileType, '3d')).all()
}

async function loadTextRows(database: Database): Promise<AssetThumbRow[]> {
  return database
    .select(ASSET_THUMB_COLUMNS)
    .from(assets)
    .where(or(eq(assets.fileType, 'code'), eq(assets.fileType, 'document')))
    .all()
}

function isTextPreviewAsset(fileType: string, extNoDot: string): boolean {
  return (fileType === 'code' || fileType === 'document') && isTextPreviewExtension('.' + extNoDot)
}

const thumbService = () => getThumbnailService()

export const model3dThumbnailJob: AsyncThumbnailJob = {
  id: 'model3d',
  logTag: 'ModelThumbnail',
  matchesAsset: (fileType, extNoDot) =>
    fileType === '3d' && isModel3dPreviewExtension(extNoDot),
  loadRows: load3dRows,
  rowsAreCandidatesOnly: false,
  beforeBatch: async () => {
    await waitForModelSnapshotBridge(120_000)
  },
  beforeGenerate: async () => {
    await waitForModelSnapshotBridge(120_000)
  },
  generate: (absFile, assetId, extNoDot, opts) =>
    thumbService().generateModel(absFile, assetId, extNoDot, opts),
  maxAttempts: 3,
  retryDelayMs: (attempt) => 1500 * attempt,
  skipMarkReason: 'render failed after retries',
  regenerateFailReason: '3D render failed',
  extractColor: true
}

export const embeddedDccThumbnailJob: AsyncThumbnailJob = {
  id: 'embedded-dcc',
  logTag: 'EmbeddedDccThumbnail',
  matchesAsset: (fileType, extNoDot) =>
    fileType === '3d' && isEmbeddedDccThumbExtension('.' + extNoDot),
  loadRows: async (database) => {
    const rows = await load3dRows(database)
    return rows.filter((r) => isEmbeddedDccThumbExtension('.' + r.extension))
  },
  rowsAreCandidatesOnly: true,
  generate: (absFile, assetId, extNoDot, opts) =>
    thumbService().generateEmbeddedDcc(absFile, assetId, extNoDot, opts),
  maxAttempts: 3,
  retryDelayMs: (attempt) => 500 * attempt,
  skipMarkReason: 'embedded-dcc-extract-failed',
  regenerateFailReason: 'embedded extract failed',
  extractColor: true
}

export const textPreviewThumbnailJob: AsyncThumbnailJob = {
  id: 'text-preview',
  logTag: 'TextPreviewThumbnail',
  matchesAsset: isTextPreviewAsset,
  loadRows: async (database) => {
    const rows = await loadTextRows(database)
    return rows.filter((r) => isTextPreviewAsset(r.fileType, r.extension))
  },
  rowsAreCandidatesOnly: true,
  generate: (absFile, assetId, extNoDot, opts) =>
    thumbService().generateTextPreview(absFile, assetId, extNoDot, opts),
  maxAttempts: 2,
  retryDelayMs: () => 300,
  skipMarkReason: 'text-preview-render-failed',
  regenerateFailReason: 'text preview render failed',
  extractColor: true
}

/** Startup backfill order: 3D → DCC → text. */
export const ASYNC_THUMBNAIL_JOBS: AsyncThumbnailJob[] = [
  model3dThumbnailJob,
  embeddedDccThumbnailJob,
  textPreviewThumbnailJob
]

export function resolveAsyncThumbnailJob(
  fileType: string,
  extNoDot: string
): AsyncThumbnailJob | null {
  return ASYNC_THUMBNAIL_JOBS.find((job) => job.matchesAsset(fileType, extNoDot)) ?? null
}
