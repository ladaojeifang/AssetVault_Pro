import { app } from 'electron'
import type { AppInfoResponse } from '@/shared/webApiTypes'
import { jsendSuccess } from '../serialize'

export function getAppInfo(): AppInfoResponse {
  return {
    name: 'AssetVault Pro',
    version: app.getVersion(),
    apiVersion: 'v1',
    platform: process.platform,
    packaged: app.isPackaged,
    features: ['fullPageSession', 'articleBundleSession']
  }
}

export function handleAppInfo() {
  return jsendSuccess(getAppInfo())
}
