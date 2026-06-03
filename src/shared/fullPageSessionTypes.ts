/** Full-page screenshot session API (browser extension ↔ Web API v1). */

export type FullPageOutputFormat = 'jpeg' | 'png'

export type FullPageSessionState =
  | 'collecting'
  | 'finishing'
  | 'finished'
  | 'aborted'
  | 'expired'

export type FullPageWarningCode =
  | 'capture_incomplete'
  | 'page_height_capped'
  | 'output_scaled_down'
  | 'overlap_clamped'

export const FULLPAGE_SESSION_LIMITS = {
  maxActiveSessions: 4,
  maxStrips: 512,
  maxStripBytes: 50 * 1024 * 1024,
  maxSessionBytes: 300 * 1024 * 1024,
  maxOutputBytes: 300 * 1024 * 1024,
  defaultMaxOutputPixels: 120_000_000,
  defaultMaxOutputSide: 32_768,
  defaultSessionTtlSeconds: 3600,
  appendTimeoutMs: 30_000,
  finishTimeoutMs: 180_000
} as const
