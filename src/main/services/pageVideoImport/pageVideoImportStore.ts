import { v4 as uuidv4 } from 'uuid'
import type {
  PageVideoJobError,
  PageVideoJobPublic,
  PageVideoJobStage,
  PageVideoJobStatus,
  PageVideoCookiesBrowser
} from '@/shared/pageVideoImportTypes'
import { PAGE_VIDEO_IMPORT_LIMITS } from '@/shared/pageVideoImportTypes'
import { savePersistedPageVideoJobs } from './pageVideoImportPersistence'

export type PageVideoJobRecord = {
  jobId: string
  batchId: string | null
  status: PageVideoJobStatus
  stage: PageVideoJobStage | null
  progressPercent: number | null
  url: string
  platform: string | null
  format: string
  cookiesFromBrowser: PageVideoCookiesBrowser
  cookiesFile: string | null
  cookieHeader: string | null
  noPlaylist: boolean
  targetFolderId: string | null
  duplicatePolicy: 'import_copy' | 'use_existing'
  sourcePageUrl: string
  pageTitle: string | null
  tempDir: string
  assetId: string | null
  skipped: boolean
  existingAssetId: string | null
  error: PageVideoJobError | null
  warnings: string[]
  ytDlp: PageVideoJobPublic['ytDlp']
  output: PageVideoJobPublic['output']
  createdAt: Date
  startedAt: Date | null
  updatedAt: Date
  completedAt: Date | null
  cancelRequested: boolean
  writeSubs: boolean
  subtitleLangs: string[] | null
  /** Kill active yt-dlp child (running jobs only). */
  ytdlpCancel?: () => void
}

const jobs = new Map<string, PageVideoJobRecord>()
let persistEnabled = false
let persistTimer: ReturnType<typeof setTimeout> | null = null

export function enablePageVideoJobPersistence(): void {
  persistEnabled = true
}

function schedulePersist(): void {
  if (!persistEnabled) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      savePersistedPageVideoJobs(jobs.values())
    } catch (e) {
      console.warn('[PageVideoImport] job persist failed:', e)
    }
  }, 400)
}

export function newJobId(): string {
  return `pvi_${uuidv4()}`
}

export function newBatchId(): string {
  return `pvb_${uuidv4()}`
}

export function getJob(jobId: string): PageVideoJobRecord | undefined {
  return jobs.get(jobId)
}

export function listActiveJobIds(): Set<string> {
  const ids = new Set<string>()
  for (const [id, j] of jobs) {
    if (j.status === 'queued' || j.status === 'running') ids.add(id)
  }
  return ids
}

export function countQueuedJobs(): number {
  let n = 0
  for (const j of jobs.values()) {
    if (j.status === 'queued') n++
  }
  return n
}

export function countRunningJobs(): number {
  let n = 0
  for (const j of jobs.values()) {
    if (j.status === 'running') n++
  }
  return n
}

export function countActiveJobs(): number {
  return countQueuedJobs() + countRunningJobs()
}

export function queuePositionFor(jobId: string): number {
  let pos = 0
  for (const j of jobs.values()) {
    if (j.status !== 'queued') continue
    if (j.jobId === jobId) return pos
    pos++
  }
  return 0
}

export function hydratePageVideoJobs(records: PageVideoJobRecord[]): void {
  for (const r of records) {
    jobs.set(r.jobId, r)
  }
  purgeOldTerminalJobs()
}

export function insertJob(record: PageVideoJobRecord, opts?: { skipPersist?: boolean }): void {
  jobs.set(record.jobId, record)
  purgeOldTerminalJobs()
  if (!opts?.skipPersist) schedulePersist()
}

export function updateJob(jobId: string, patch: Partial<PageVideoJobRecord>): PageVideoJobRecord | undefined {
  const j = jobs.get(jobId)
  if (!j) return undefined
  Object.assign(j, patch, { updatedAt: new Date() })
  schedulePersist()
  return j
}

export function removeJob(jobId: string): void {
  jobs.delete(jobId)
  schedulePersist()
}

export function listJobsByBatchId(batchId: string): PageVideoJobRecord[] {
  const out: PageVideoJobRecord[] = []
  for (const j of jobs.values()) {
    if (j.batchId === batchId) out.push(j)
  }
  return out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

function purgeOldTerminalJobs(): void {
  const cutoff = Date.now() - PAGE_VIDEO_IMPORT_LIMITS.jobRetentionMs
  for (const [id, j] of jobs) {
    if (j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled') continue
    const t = j.completedAt?.getTime() ?? j.updatedAt.getTime()
    if (t < cutoff) jobs.delete(id)
  }
}

export function toPublicJob(j: PageVideoJobRecord): PageVideoJobPublic {
  return {
    jobId: j.jobId,
    batchId: j.batchId,
    status: j.status,
    stage: j.stage,
    progressPercent: j.progressPercent,
    url: j.url,
    platform: j.platform ?? undefined,
    assetId: j.assetId,
    skipped: j.skipped,
    existingAssetId: j.existingAssetId,
    error: j.error,
    warnings: j.warnings.length ? j.warnings : undefined,
    ytDlp: j.ytDlp ?? null,
    output: j.output ?? null,
    pollAfterMs: PAGE_VIDEO_IMPORT_LIMITS.pollAfterMs,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    updatedAt: j.updatedAt.toISOString(),
    completedAt: j.completedAt?.toISOString() ?? null
  }
}

export function assertQueueCapacity(): void {
  if (countActiveJobs() >= PAGE_VIDEO_IMPORT_LIMITS.maxQueuedJobs) {
    throw new Error('PAGE_VIDEO_QUEUE_FULL')
  }
}

export function listQueuedJobs(): PageVideoJobRecord[] {
  const out: PageVideoJobRecord[] = []
  for (const j of jobs.values()) {
    if (j.status === 'queued') out.push(j)
  }
  return out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}
