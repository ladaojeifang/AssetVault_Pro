export type ArticleBundleSessionState =
  | 'collecting'
  | 'finishing'
  | 'finished'
  | 'aborted'
  | 'expired'

export type ArticleBundleWarningCode =
  | 'ASSET_FILE_MISSING'
  | 'ASSET_FILE_TOO_LARGE'

export const ARTICLE_BUNDLE_SESSION_LIMITS = {
  maxActiveSessions: 4,
  maxAssetFiles: 500,
  maxSingleFileBytes: 100 * 1024 * 1024, // 100MB
  maxSessionBytes: 500 * 1024 * 1024, // 500MB
  defaultSessionTtlSeconds: 3600,
  appendTimeoutMs: 30_000,
  finishTimeoutMs: 120_000
} as const
