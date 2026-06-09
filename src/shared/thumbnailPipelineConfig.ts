/**
 * Central defaults for the thumbnail pipeline (timeouts, retries, output bounds).
 * User preference `thumbnailMaxEdge` / `thumbnailQuality` override output via ThumbnailService.
 */
export const THUMBNAIL_PIPELINE = {
  output: {
    defaultMaxEdge: 256,
    minMaxEdge: 128,
    maxMaxEdge: 512,
    defaultQuality: 80,
    minQuality: 10,
    maxQuality: 100
  },
  startup: {
    mainWindowIdleMs: 60_000,
    mainWindowSettleMs: 2_000,
    mainWindowPollMs: 250,
    /** Delay before ffmpeg text-preview backfill (avoids racing main-window load on Windows). */
    postStartupTextThumbDelayMs: 8_000,
    /** Delay before 3D/DCC backfill (WebGL hidden window). */
    postStartupGpuThumbDelayMs: 45_000
  },
  model3d: {
    renderTimeoutMs: 120_000,
    windowInitMs: 120_000,
    bridgeWaitMs: 120_000,
    bridgeWaitIpcMs: 90_000,
    bridgeIdleSettleMs: 1_500,
    bridgeIdleCapMs: 60_000,
    bridgePollMs: 400
  },
  svg: {
    renderTimeoutMs: 30_000,
    windowInitMs: 30_000
  },
  grid: {
    /** IPC polls while async thumb (3D / DCC / text) is still empty. */
    ipcMaxAttempts: 24,
    ipcRetryBaseMs: 1_500,
    ipcRetryStepMs: 1_000,
    ipcRetryCapMs: 8_000
  },
  asyncJobs: {
    model3d: { maxAttempts: 3, retryDelayBaseMs: 1_500 },
    embeddedDcc: { maxAttempts: 3, retryDelayStepMs: 500 },
    textPreview: { maxAttempts: 2, retryDelayMs: 300 }
  },
  textPreview: {
    maxLines: 22,
    maxCols: 34,
    maxBytes: 64 * 1024
  }
} as const

/** @deprecated Use THUMBNAIL_PIPELINE.output.defaultMaxEdge */
export const THUMBNAIL_DEFAULT_MAX_EDGE = THUMBNAIL_PIPELINE.output.defaultMaxEdge

export function clampThumbnailMaxEdge(edge: number): number {
  const { minMaxEdge, maxMaxEdge } = THUMBNAIL_PIPELINE.output
  return Math.min(maxMaxEdge, Math.max(minMaxEdge, Math.floor(edge)))
}

export function clampThumbnailQuality(quality: number): number {
  const { minQuality, maxQuality } = THUMBNAIL_PIPELINE.output
  return Math.min(maxQuality, Math.max(minQuality, Math.floor(quality)))
}

/** Delay before grid IPC retry N (0-based attempt index after a miss). */
export function gridThumbnailRetryDelayMs(attempt: number): number {
  const { ipcRetryBaseMs, ipcRetryStepMs, ipcRetryCapMs } = THUMBNAIL_PIPELINE.grid
  return Math.min(ipcRetryCapMs, ipcRetryBaseMs + attempt * ipcRetryStepMs)
}
