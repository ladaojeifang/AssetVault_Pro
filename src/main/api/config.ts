export type ApiServerConfig = {
  host: string
  port: number
  /** When true, listen on 0.0.0.0 and require bearer token. */
  allowRemote: boolean
  token?: string
}

import { getAppPreferencesSnapshot } from '../services/appPreferencesStore'

const DEFAULT_PORT = 41596

function prefsConfig(): Partial<ApiServerConfig> | null {
  try {
    const w = getAppPreferencesSnapshot().webApi
    return {
      host: w.allowRemote ? '0.0.0.0' : w.bind,
      port: w.port,
      allowRemote: w.allowRemote,
      token: w.allowRemote ? w.token : undefined
    }
  } catch {
    return null
  }
}

export function resolveApiServerConfig(overrides?: Partial<ApiServerConfig>): ApiServerConfig {
  const fromPrefs = prefsConfig()
  const port =
    overrides?.port ??
    fromPrefs?.port ??
    parseInt(process.env.WEB_API_PORT ?? String(DEFAULT_PORT), 10)
  const allowRemote =
    overrides?.allowRemote ??
    fromPrefs?.allowRemote ??
    process.env.WEB_API_ALLOW_REMOTE === '1'
  const host =
    overrides?.host ??
    fromPrefs?.host ??
    (allowRemote ? '0.0.0.0' : '127.0.0.1')
  return {
    host,
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    allowRemote,
    token: overrides?.token ?? fromPrefs?.token ?? process.env.WEB_API_TOKEN
  }
}
