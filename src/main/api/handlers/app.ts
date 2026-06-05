import { existsSync } from 'fs'
import { app } from 'electron'
import type { AppInfoResponse } from '@/shared/webApiTypes'
import { PAGE_VIDEO_IMPORT_LIMITS } from '@/shared/pageVideoImportTypes'
import { jsendSuccess } from '../serialize'
import {
  getManagedYtdlpPath,
  getYtdlpVersion,
  isFfmpegPresent,
  resetYtdlpCache,
  resolveYtdlpExecutable
} from '../../services/pageVideoImport/ytdlpBinary'

export function getAppInfo(): AppInfoResponse {
  const features = ['fullPageSession', 'articleBundleSession', 'pageVideoImport']
  let ytdlpExe = resolveYtdlpExecutable()
  if (!ytdlpExe && (existsSync(getManagedYtdlpPath()) || app.isPackaged)) {
    resetYtdlpCache()
    ytdlpExe = resolveYtdlpExecutable()
  }
  return {
    name: 'AssetVault Pro',
    version: app.getVersion(),
    apiVersion: 'v1',
    platform: process.platform,
    packaged: app.isPackaged,
    features,
    ytdlp: {
      version: ytdlpExe ? getYtdlpVersion() : null,
      ffmpegPresent: isFfmpegPresent(),
      ready: Boolean(ytdlpExe)
    },
    limits: {
      pageVideoImport: {
        maxBatchItems: PAGE_VIDEO_IMPORT_LIMITS.maxBatchItems,
        maxConcurrentJobs: PAGE_VIDEO_IMPORT_LIMITS.maxConcurrentJobs,
        maxActiveJobs: PAGE_VIDEO_IMPORT_LIMITS.maxQueuedJobs,
        jobTimeoutMs: PAGE_VIDEO_IMPORT_LIMITS.jobTimeoutMs,
        stallTimeoutMs: PAGE_VIDEO_IMPORT_LIMITS.stallTimeoutMs,
        pollIntervalMsRecommended: PAGE_VIDEO_IMPORT_LIMITS.pollAfterMs,
        defaultFormatPreset: PAGE_VIDEO_IMPORT_LIMITS.defaultFormatPreset,
        defaultMaxVideoHeight: PAGE_VIDEO_IMPORT_LIMITS.defaultMaxVideoHeight
      }
    }
  }
}

export function handleAppInfo() {
  return jsendSuccess(getAppInfo())
}
