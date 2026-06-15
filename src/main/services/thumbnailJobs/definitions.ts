import { eq, or } from 'drizzle-orm'
import { assets } from '../../db/schema'
import { getThumbnailService } from '../ThumbnailService'
import { waitForModelSnapshotBridge } from '../modelThumbnailRenderer'
import { isEmbeddedDccThumbExtension } from '@/shared/embeddedDccFormats'
import { isTextPreviewExtension } from '@/shared/textPreviewFormats'
import { resolveAsyncThumbnailKind } from '@/shared/formatCapabilities'
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

function matchesModel3d(extNoDot: string): boolean {
  return resolveAsyncThumbnailKind(extNoDot) === 'model3d'
}

function matchesEmbeddedDcc(extNoDot: string): boolean {
  return resolveAsyncThumbnailKind(extNoDot) === 'embedded-dcc'
}

function matchesTextPreview(extNoDot: string): boolean {
  return resolveAsyncThumbnailKind(extNoDot) === 'text-preview'
}

const thumbService = () => getThumbnailService()

export const model3dThumbnailJob: AsyncThumbnailJob = {
  id: 'model3d',
  logTag: 'ModelThumbnail',
  matchesAsset: matchesModel3d,
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
  matchesAsset: matchesEmbeddedDcc,
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
  matchesAsset: matchesTextPreview,
  loadRows: async (database) => {
    const rows = await loadTextRows(database)
    return rows.filter((r) => isTextPreviewExtension('.' + r.extension))
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

export function resolveAsyncThumbnailJob(extNoDot: string): AsyncThumbnailJob | null {
  return ASYNC_THUMBNAIL_JOBS.find((job) => job.matchesAsset(extNoDot)) ?? null
}
