import type { PageVideoFormatPreset } from './pageVideoFormatPolicy'

/** Limits and defaults for page-video import (aligned with extension spec). */
/** Public / optional-login platforms: skip extension cookies to avoid yt-dlp web-client format failures. */
export const PAGE_VIDEO_COOKIE_OPTIONAL_PLATFORMS = new Set([
  'youtube',
  'vimeo',
  'twitter'
])

export function isPageVideoCookieOptionalPlatform(platform?: string | null): boolean {
  const p = platform?.trim().toLowerCase()
  if (!p) return false
  return PAGE_VIDEO_COOKIE_OPTIONAL_PLATFORMS.has(p)
}

export const PAGE_VIDEO_IMPORT_LIMITS = {
  maxBatchItems: 50,
  maxConcurrentJobs: 2,
  /** Max queued + running jobs in memory (not queue-only). */
  maxQueuedJobs: 100,
  jobTimeoutMs: 3_600_000,
  stallTimeoutMs: 600_000,
  pollAfterMs: 1500,
  defaultFormat: 'bestvideo*+bestaudio/best',
  defaultFormatPreset: '1080p_mp4' as PageVideoFormatPreset,
  defaultMaxVideoHeight: 1080,
  jobRetentionMs: 86_400_000
} as const

export type { PageVideoFormatPreset }

export type PageVideoJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type PageVideoJobStage =
  | 'queued'
  | 'extracting'
  | 'downloading'
  | 'postprocessing'
  | 'importing'
  | 'done'

export type PageVideoCookiesBrowser = 'edge' | 'chrome' | 'firefox' | 'none'

export type PageVideoCreateBody = {
  url: string
  platform?: string
  targetFolderId?: string | null
  /** `replace` is accepted but treated as `import_copy` with warning `REPLACE_NOT_IMPLEMENTED`. */
  duplicatePolicy?: 'import_copy' | 'use_existing' | 'replace'
  format?: string
  formatPreset?: PageVideoFormatPreset
  cookiesFromBrowser?: PageVideoCookiesBrowser
  /** Netscape cookies.txt path (from DevTools export extension). */
  cookiesFile?: string
  /** Raw `Cookie:` header value from DevTools Network (Bilibili etc.). */
  cookieHeader?: string
  sourceMeta?: {
    pageUrl?: string
    pageTitle?: string
    submittedBy?: string
    tabId?: number
  }
  options?: {
    writeSubs?: boolean
    subtitleLangs?: string[]
    noPlaylist?: boolean
  }
}

export type PageVideoJobError = {
  code: string
  message: string
  detail?: string
}

export type PageVideoJobPublic = {
  jobId: string
  batchId?: string | null
  status: PageVideoJobStatus
  stage?: PageVideoJobStage | null
  progressPercent?: number | null
  url: string
  platform?: string
  assetId?: string | null
  skipped?: boolean
  existingAssetId?: string | null
  error?: PageVideoJobError | null
  warnings?: string[]
  ytDlp?: {
    title?: string
    durationSec?: number
    extractor?: string
  } | null
  output?: {
    filename?: string
    fileBytes?: number
    durationSec?: number
    width?: number
    height?: number
  } | null
  pollAfterMs?: number
  createdAt: string
  startedAt?: string | null
  updatedAt: string
  completedAt?: string | null
}

export type PageVideoCreateResult = {
  jobId: string
  status: PageVideoJobStatus
  queuePosition?: number
  url: string
  createdAt: string
  pollAfterMs?: number
}

export type PageVideoBatchCreateResult = {
  batchId: string
  jobs: Array<{ jobId: string; url: string; status: PageVideoJobStatus }>
  total: number
  createdAt: string
}

export type PageVideoCancelResult = {
  jobId: string
  status: PageVideoJobStatus
  cancelled: boolean
  filesRemoved: boolean
}

export type PageVideoBatchStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'

export type PageVideoBatchGetResult = {
  batchId: string
  status: PageVideoBatchStatus
  jobs: PageVideoJobPublic[]
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
}
