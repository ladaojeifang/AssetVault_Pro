import { randomUUID } from 'crypto'
import {
  getAppPreferencesSnapshot,
  readAppPreferences,
  writeAppPreferences
} from '../services/appPreferencesStore'
import type { WebApiPreferences } from '@/shared/webApiPreferences'
import { webApiBaseUrl, webApiNeedsToken } from '@/shared/webApiPreferences'
import type { ApiServerConfig } from './config'
import { getApiServerConfig, restartApiServer, startApiServer, stopApiServer } from './server'

export type WebApiStatus = {
  running: boolean
  enabled: boolean
  baseUrl: string
  playgroundUrl: string
  openApiUrl: string
  port: number
  bind: string
  allowRemote: boolean
  /** Empty when localhost-only and token not required for display. */
  token: string
}

export function preferencesToApiConfig(prefs: WebApiPreferences): ApiServerConfig {
  return {
    host: prefs.allowRemote ? '0.0.0.0' : prefs.bind,
    port: prefs.port,
    allowRemote: prefs.allowRemote,
    token: prefs.allowRemote ? prefs.token : undefined
  }
}

export function getWebApiStatus(): WebApiStatus {
  const prefs = getAppPreferencesSnapshot().webApi
  const base = webApiBaseUrl(prefs)
  const running = getApiServerConfig() != null
  return {
    running,
    enabled: prefs.enabled,
    baseUrl: base,
    playgroundUrl: `${base}/playground/`,
    openApiUrl: `${base}/docs/openapi.yaml`,
    port: prefs.port,
    bind: prefs.bind,
    allowRemote: prefs.allowRemote,
    token: prefs.token
  }
}

function secureWebApiPrefs(prefs: WebApiPreferences): WebApiPreferences {
  const bind = prefs.allowRemote ? ('0.0.0.0' as const) : prefs.bind
  const token =
    prefs.allowRemote && !prefs.token.trim() ? randomUUID() : prefs.token
  return { ...prefs, bind, token }
}

export async function applyWebApiFromPreferences(): Promise<void> {
  const snap = getAppPreferencesSnapshot()
  let prefs = secureWebApiPrefs(snap.webApi)
  if (
    prefs.token !== snap.webApi.token ||
    prefs.bind !== snap.webApi.bind
  ) {
    writeAppPreferences({ ...snap, webApi: prefs })
  }

  await stopApiServer()
  if (!prefs.enabled) {
    console.log('[WebAPI] Disabled in preferences')
    return
  }

  try {
    await startApiServer(preferencesToApiConfig(prefs), { force: true })
  } catch (e) {
    console.error('[WebAPI] Failed to start:', e)
    throw e
  }
}

export async function regenerateWebApiToken(): Promise<WebApiStatus> {
  const snap = readAppPreferences()
  const next = {
    ...snap,
    webApi: { ...snap.webApi, token: randomUUID(), allowRemote: true, bind: '0.0.0.0' as const }
  }
  writeAppPreferences(next)
  await applyWebApiFromPreferences()
  return getWebApiStatus()
}
