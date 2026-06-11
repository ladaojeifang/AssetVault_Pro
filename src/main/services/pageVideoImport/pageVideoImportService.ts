import { basename } from 'path'
import { statSync } from 'fs'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../../db'
import { assets, folders } from '../../db/schema'
import { flushDatabase } from '../../db'
import {
  isPageVideoCookieOptionalPlatform,
  PAGE_VIDEO_IMPORT_LIMITS,
  type PageVideoBatchCreateResult,
  type PageVideoBatchStatus,
  type PageVideoCancelResult,
  type PageVideoCreateResult,
  type PageVideoBatchGetResult,
  type PageVideoJobPublic,
  type PageVideoJobStatus
} from '@/shared/pageVideoImportTypes'
import { getAppPreferencesSnapshot } from '../appPreferencesStore'
import { ensureManagedYtdlpBinary, resolveYtdlpExecutable, getYtdlpVersion } from './ytdlpBinary'
import { createJobTempDir, removeJobTempDir, purgeOrphanYtdlpTempDirs } from './pageVideoImportPathPolicy'
import { loadPersistedPageVideoJobs } from './pageVideoImportPersistence'
import { runYtdlpDownload } from './ytdlpRunner'
import { buildBatchItemBody, parseCreateBody } from './pageVideoImportParse'
import { isBrowserCookieReadFailure } from './ytdlpStderr'
import {
  assertQueueCapacity,
  countRunningJobs,
  getJob,
  enablePageVideoJobPersistence,
  hydratePageVideoJobs,
  insertJob,
  listJobsByBatchId,
  listQueuedJobs,
  listActiveJobIds,
  newBatchId,
  newJobId,
  queuePositionFor,
  toPublicJob,
  updateJob,
  type PageVideoJobRecord
} from './pageVideoImportStore'
import { importAssetFromPath } from '../assetImportService'
import { patchAsset } from '../assetMutationService'
import { getAssetById } from '../assetQueryService'
import { assertPageVideoUrl } from '@/shared/pageVideoUrlPolicy'

const ERROR_MESSAGES: Record<string, string> = {
  YTDLP_NOT_INSTALLED: '未检测到 yt-dlp 二进制（将尝试自动下载官方编译版）',
  YTDLP_AUTH_REQUIRED: '该站点需要登录；请在 Edge/Chrome 登录后重试，或关闭浏览器后再导入',
  YTDLP_COOKIE_COPY_FAILED:
    '无法读取浏览器 Cookie（Chrome/Edge 运行时数据库被锁定）。可关闭浏览器后重试，或对公开视频使用 cookiesFromBrowser: none',
  YTDLP_EXTRACTOR_FAILED: '无法解析该页面视频',
  YTDLP_FORMAT_UNAVAILABLE: '当前清晰度/格式不可用，请改用「最佳」预设或降低分辨率后重试',
  YTDLP_DOWNLOAD_FAILED: '视频下载失败',
  YTDLP_POSTPROCESS_FAILED: '视频合并或后处理失败',
  YTDLP_STALLED: '下载长时间无进度',
  YTDLP_JOB_TIMEOUT: '下载总时长超过限制',
  YTDLP_INTERRUPTED: '应用重启导致任务中断',
  IMPORT_FAILED: '下载成功但入库失败',
  BATCH_NOT_FOUND: '批量任务不存在',
  PAGE_VIDEO_NOT_SUPPORTED: '该 URL 为直链媒体，请使用 importFromURL',
  PAGE_VIDEO_QUEUE_FULL: '作品页视频导入队列已满',
  BATCH_TOO_LARGE: '批量条数超过上限',
  BATCH_EMPTY: '批量列表为空',
  JOB_NOT_FOUND: '任务不存在',
  INVALID_REQUEST: '请求参数无效'
}

let pumpScheduled = false

function pageVideoParseDefaults() {
  const pvi = getAppPreferencesSnapshot().pageVideoImport
  return {
    formatPreset: pvi.defaultFormatPreset,
    maxVideoHeight: pvi.maxVideoHeight
  }
}

function aggregateBatchStatus(
  statuses: PageVideoJobStatus[]
): {
  status: PageVideoBatchStatus
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
} {
  const counts = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  }
  for (const s of statuses) {
    if (s in counts) counts[s as keyof typeof counts]++
  }
  let status: PageVideoBatchStatus = 'queued'
  if (counts.running > 0) status = 'running'
  else if (counts.queued > 0 && counts.completed + counts.failed + counts.cancelled > 0) {
    status = 'running'
  } else if (counts.completed === statuses.length) status = 'completed'
  else if (counts.cancelled === statuses.length) status = 'cancelled'
  else if (counts.failed === statuses.length) status = 'failed'
  else if (counts.failed > 0 && counts.completed > 0) status = 'partial'
  else if (counts.failed > 0) status = 'failed'
  else if (counts.queued > 0) status = 'queued'
  return { status, ...counts }
}

async function assertTargetFolder(folderId: string | null | undefined): Promise<void> {
  if (!folderId) return
  const database = getDatabase()
  const row = await database.select({ id: folders.id }).from(folders).where(eq(folders.id, folderId)).get()
  if (!row) throw new Error('FOLDER_NOT_FOUND')
}

async function findAssetIdBySourceUrl(sourceUrl: string): Promise<string | null> {
  const database = getDatabase()
  const row = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.sourceUrl, sourceUrl))
    .get()
  return row?.id ?? null
}

function buildJobRecord(
  parsed: ReturnType<typeof parseCreateBody>,
  batchId: string | null
): PageVideoJobRecord {
  assertPageVideoUrl(parsed.url)
  const jobId = newJobId()
  const pageUrl = parsed.sourceMeta?.pageUrl?.trim() || parsed.url
  const now = new Date()
  return {
    jobId,
    batchId,
    status: 'queued',
    stage: 'queued',
    progressPercent: null,
    url: parsed.url,
    platform: parsed.platform ?? null,
    format: parsed.format ?? 'best',
    cookiesFromBrowser: parsed.cookiesFromBrowser ?? 'none',
    cookiesFile: parsed.cookiesFile ?? null,
    cookieHeader: parsed.cookieHeader ?? null,
    noPlaylist: parsed.options?.noPlaylist !== false,
    targetFolderId: parsed.targetFolderId ?? null,
    duplicatePolicy:
      parsed.duplicatePolicy === 'use_existing' ? 'use_existing' : 'import_copy',
    sourcePageUrl: pageUrl,
    pageTitle: parsed.sourceMeta?.pageTitle?.trim() ?? null,
    tempDir: createJobTempDir(jobId),
    assetId: null,
    skipped: false,
    existingAssetId: null,
    error: null,
    warnings: [...parsed.parseWarnings],
    ytDlp: null,
    output: null,
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    completedAt: null,
    cancelRequested: false,
    writeSubs: parsed.options?.writeSubs === true,
    subtitleLangs:
      parsed.options?.subtitleLangs?.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim()) ??
      null
  }
}

function schedulePump(): void {
  if (pumpScheduled) return
  pumpScheduled = true
  setImmediate(() => {
    pumpScheduled = false
    void pumpQueue()
  })
}

async function pumpQueue(): Promise<void> {
  if (countRunningJobs() >= PAGE_VIDEO_IMPORT_LIMITS.maxConcurrentJobs) return
  const next = listQueuedJobs()[0]
  if (!next) return
  updateJob(next.jobId, {
    status: 'running',
    stage: 'extracting',
    startedAt: new Date()
  })
  void runJob(next.jobId).finally(() => schedulePump())
}

function failJob(jobId: string, code: string, detail?: string): void {
  updateJob(jobId, {
    status: 'failed',
    stage: null,
    progressPercent: null,
    ytdlpCancel: undefined,
    error: {
      code,
      message: ERROR_MESSAGES[code] ?? code,
      detail
    },
    completedAt: new Date()
  })
  removeJobTempDir(jobId)
  schedulePump()
}

function completeSkipped(jobId: string, existingAssetId: string): void {
  updateJob(jobId, {
    status: 'completed',
    stage: 'done',
    progressPercent: 100,
    skipped: true,
    existingAssetId,
    assetId: null,
    ytdlpCancel: undefined,
    completedAt: new Date()
  })
  removeJobTempDir(jobId)
  schedulePump()
}

function completeSuccess(
  jobId: string,
  assetId: string,
  output: NonNullable<PageVideoJobRecord['output']>
): void {
  updateJob(jobId, {
    status: 'completed',
    stage: 'done',
    progressPercent: 100,
    assetId,
    output,
    ytdlpCancel: undefined,
    completedAt: new Date()
  })
  removeJobTempDir(jobId)
  schedulePump()
}

function isCookieCopyFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.message === 'YTDLP_COOKIE_COPY_FAILED') return true
  const detail = 'detail' in err ? String((err as Error & { detail?: string }).detail ?? '') : ''
  return isBrowserCookieReadFailure(detail)
}

async function runYtdlpForJob(jobId: string) {
  const job = getJob(jobId)!
  const { promise, cancel } = runYtdlpDownload({
    url: job.url,
    tempDir: job.tempDir,
    format: job.format,
    platform: job.platform,
    referer: job.sourcePageUrl,
    cookiesFromBrowser: job.cookiesFromBrowser,
    cookiesFile: job.cookiesFile,
    cookieHeader: job.cookieHeader,
    noPlaylist: job.noPlaylist,
    writeSubs: job.writeSubs,
    subtitleLangs: job.subtitleLangs,
    jobTimeoutMs: PAGE_VIDEO_IMPORT_LIMITS.jobTimeoutMs,
    stallTimeoutMs: PAGE_VIDEO_IMPORT_LIMITS.stallTimeoutMs,
    isCancelled: () => Boolean(getJob(jobId)?.cancelRequested),
    onStage: (stage) => {
      updateJob(jobId, { stage, updatedAt: new Date() })
    },
    onProgress: (percent) => {
      updateJob(jobId, { progressPercent: percent, updatedAt: new Date() })
    },
    onMeta: (meta) => {
      updateJob(jobId, { ytDlp: meta, updatedAt: new Date() })
    }
  })
  updateJob(jobId, { ytdlpCancel: cancel })
  try {
    return await promise
  } finally {
    updateJob(jobId, { ytdlpCancel: undefined })
  }
}

function jobHasCookieCredentials(job: PageVideoJobRecord): boolean {
  return (
    Boolean(job.cookieHeader?.trim()) ||
    Boolean(job.cookiesFile) ||
    job.cookiesFromBrowser !== 'none'
  )
}

async function runYtdlpWithCookieFallback(jobId: string) {
  const job = getJob(jobId)!
  try {
    return await runYtdlpForJob(jobId)
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    const optional = isPageVideoCookieOptionalPlatform(job.platform)
    const hasCookies = jobHasCookieCredentials(job)

    if (
      optional &&
      hasCookies &&
      (code === 'YTDLP_FORMAT_UNAVAILABLE' || isCookieCopyFailure(err))
    ) {
      const warnings = [...(getJob(jobId)?.warnings ?? []), 'PUBLIC_VIDEO_COOKIE_STRIP_RETRY']
      updateJob(jobId, {
        warnings,
        cookieHeader: null,
        cookiesFile: null,
        cookiesFromBrowser: 'none'
      })
      return runYtdlpForJob(jobId)
    }

    throw err
  }
}

async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId)
  if (!job || job.cancelRequested) return
  if (job.status !== 'running' && job.status !== 'queued') return

  if (!resolveYtdlpExecutable()) {
    failJob(jobId, 'YTDLP_NOT_INSTALLED')
    return
  }

  if (job.duplicatePolicy === 'use_existing') {
    const existing = await findAssetIdBySourceUrl(job.sourcePageUrl)
    if (existing) {
      completeSkipped(jobId, existing)
      return
    }
  }

  updateJob(jobId, { stage: 'extracting', progressPercent: null })

  try {
    const result = await runYtdlpWithCookieFallback(jobId)

    if (getJob(jobId)?.cancelRequested) {
      updateJob(jobId, { status: 'cancelled', completedAt: new Date(), ytdlpCancel: undefined })
      removeJobTempDir(jobId)
      schedulePump()
      return
    }

    const st = statSync(result.videoPath)

    updateJob(jobId, { stage: 'importing', progressPercent: 100 })

    const importResult = await importAssetFromPath(result.videoPath, {
      targetFolderId: job.targetFolderId ?? undefined,
      duplicatePolicy: job.duplicatePolicy === 'use_existing' ? 'use_existing' : 'import_copy'
    })

    if (importResult.skipped && importResult.existingAssetId) {
      completeSkipped(jobId, importResult.existingAssetId)
      await flushDatabase()
      return
    }

    const assetId = importResult.assetId
    if (!assetId) {
      failJob(jobId, 'IMPORT_FAILED')
      return
    }

    const info = result.info
    const metaPatch: Record<string, unknown> = {
      importPipeline: 'pageVideoImport',
      jobId,
      platform: job.platform,
      ytDlpVersion: getYtdlpVersion(),
      extractor:
        (typeof info?.extractor === 'string' ? info.extractor : job.ytDlp?.extractor) ?? undefined,
      durationSec:
        typeof info?.duration === 'number'
          ? info.duration
          : job.ytDlp?.durationSec,
      pageTitle: job.pageTitle ?? undefined
    }

    const existing = await getAssetById(assetId, { incrementViewCount: false })
    let mergedMeta = metaPatch
    if (existing?.metadata) {
      try {
        mergedMeta = { ...(JSON.parse(existing.metadata) as Record<string, unknown>), ...metaPatch }
      } catch {
        /* use metaPatch */
      }
    }

    await patchAsset(assetId, {
      sourceUrl: job.sourcePageUrl,
      metadata: mergedMeta
    })

    const width =
      typeof info?.width === 'number' ? info.width : typeof info?.width === 'string' ? Number(info.width) : undefined
    const height =
      typeof info?.height === 'number'
        ? info.height
        : typeof info?.height === 'string'
          ? Number(info.height)
          : undefined

    completeSuccess(jobId, assetId, {
      filename: basename(result.videoPath),
      fileBytes: st.size,
      durationSec:
        typeof info?.duration === 'number'
          ? info.duration
          : job.ytDlp?.durationSec ?? undefined,
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined
    })
    await flushDatabase()
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err)
    if (code === 'JOB_CANCELLED') {
      updateJob(jobId, { status: 'cancelled', completedAt: new Date(), ytdlpCancel: undefined })
      removeJobTempDir(jobId)
      schedulePump()
      return
    }
    const detail = err instanceof Error && 'detail' in err ? String((err as Error & { detail?: string }).detail) : undefined
    if (ERROR_MESSAGES[code]) {
      failJob(jobId, code, detail)
    } else {
      failJob(jobId, 'YTDLP_DOWNLOAD_FAILED', detail ?? code)
    }
  }
}

async function requireYtdlp(): Promise<void> {
  if (!resolveYtdlpExecutable()) {
    await ensureManagedYtdlpBinary()
  }
  if (!resolveYtdlpExecutable()) throw new Error('YTDLP_NOT_INSTALLED')
}

export async function pageVideoImportCreate(
  body: Record<string, unknown>
): Promise<PageVideoCreateResult> {
  await requireYtdlp()
  assertQueueCapacity()
  const parsed = parseCreateBody(body, pageVideoParseDefaults())
  await assertTargetFolder(parsed.targetFolderId ?? undefined)
  const job = buildJobRecord(parsed, null)
  insertJob(job)
  schedulePump()
  return {
    jobId: job.jobId,
    status: 'queued',
    queuePosition: queuePositionFor(job.jobId),
    url: job.url,
    createdAt: job.createdAt.toISOString(),
    pollAfterMs: PAGE_VIDEO_IMPORT_LIMITS.pollAfterMs
  }
}

export async function pageVideoImportBatch(
  body: Record<string, unknown>
): Promise<PageVideoBatchCreateResult> {
  await requireYtdlp()
  const items = body.items
  if (!Array.isArray(items) || items.length === 0) throw new Error('BATCH_EMPTY')
  if (items.length > PAGE_VIDEO_IMPORT_LIMITS.maxBatchItems) throw new Error('BATCH_TOO_LARGE')

  const sharedTarget =
    body.targetFolderId === null
      ? null
      : typeof body.targetFolderId === 'string' && body.targetFolderId
        ? body.targetFolderId
        : undefined
  await assertTargetFolder(sharedTarget ?? undefined)

  const batchId = newBatchId()
  const createdAt = new Date().toISOString()
  const jobs: PageVideoBatchCreateResult['jobs'] = []

  for (const raw of items) {
    assertQueueCapacity()
    const item =
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>)
    const parsed = parseCreateBody(
      buildBatchItemBody(body, item, sharedTarget),
      pageVideoParseDefaults()
    )
    const job = buildJobRecord(parsed, batchId)
    insertJob(job)
    jobs.push({ jobId: job.jobId, url: job.url, status: 'queued' })
  }

  schedulePump()
  return { batchId, jobs, total: jobs.length, createdAt }
}

export function pageVideoImportGetJob(jobId: string): PageVideoJobPublic {
  const job = getJob(jobId)
  if (!job) throw new Error('JOB_NOT_FOUND')
  return toPublicJob(job)
}

export function pageVideoImportGetBatch(batchId: string): PageVideoBatchGetResult {
  const jobs = listJobsByBatchId(batchId)
  if (jobs.length === 0) throw new Error('BATCH_NOT_FOUND')
  const publicJobs = jobs.map(toPublicJob)
  const agg = aggregateBatchStatus(publicJobs.map((j) => j.status))
  return {
    batchId,
    ...agg,
    jobs: publicJobs,
    total: jobs.length
  }
}

const INTERRUPTED_MESSAGE = ERROR_MESSAGES.YTDLP_INTERRUPTED!

export function restorePageVideoJobsOnStartup(): void {
  const loaded = loadPersistedPageVideoJobs()
  if (loaded.length === 0) {
    enablePageVideoJobPersistence()
    return
  }

  const restored: PageVideoJobRecord[] = []
  for (const record of loaded) {
    if (record.status === 'running') {
      restored.push({
        ...record,
        status: 'failed',
        stage: null,
        progressPercent: null,
        completedAt: new Date(),
        error: {
          code: 'YTDLP_INTERRUPTED',
          message: INTERRUPTED_MESSAGE
        }
      })
      continue
    }
    if (record.status === 'queued') {
      restored.push({
        ...record,
        tempDir: createJobTempDir(record.jobId),
        cancelRequested: false
      })
      continue
    }
    restored.push(record)
  }

  hydratePageVideoJobs(restored)
  enablePageVideoJobPersistence()

  for (const j of listQueuedJobs()) {
    schedulePump()
    break
  }
}

export function pageVideoImportCancel(jobId: string): PageVideoCancelResult {
  const job = getJob(jobId)
  if (!job) throw new Error('JOB_NOT_FOUND')

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return {
      jobId,
      status: job.status,
      cancelled: job.status === 'cancelled',
      filesRemoved: false
    }
  }

  updateJob(jobId, { cancelRequested: true })
  getJob(jobId)?.ytdlpCancel?.()

  if (job.status === 'queued') {
    updateJob(jobId, { status: 'cancelled', completedAt: new Date() })
    const removed = removeJobTempDir(jobId)
    schedulePump()
    return { jobId, status: 'cancelled', cancelled: true, filesRemoved: removed }
  }

  return {
    jobId,
    status: 'running',
    cancelled: true,
    filesRemoved: false
  }
}

export function purgeOrphanPageVideoTempOnStartup(): number {
  return purgeOrphanYtdlpTempDirs(listActiveJobIds())
}

/** Call once at app startup before Web API serves page-video routes. */
export function initPageVideoImportOnStartup(): void {
  restorePageVideoJobsOnStartup()
  const purged = purgeOrphanPageVideoTempOnStartup()
  if (purged > 0) {
    console.log(`[PageVideoImport] purged ${purged} orphan temp dir(s)`)
  }
}
