export type WebApiBind = '127.0.0.1' | '0.0.0.0'

export type WebApiPreferences = {
  /** Listen for HTTP API while the app is running. */
  enabled: boolean
  port: number
  bind: WebApiBind
  /** Listen on 0.0.0.0 and require Bearer token when true. */
  allowRemote: boolean
  token: string
}

export const DEFAULT_WEB_API_PREFERENCES: WebApiPreferences = {
  enabled: true,
  port: 41596,
  bind: '127.0.0.1',
  allowRemote: false,
  token: ''
}

function clampPort(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_WEB_API_PREFERENCES.port
  return Math.min(65535, Math.max(1024, Math.floor(n)))
}

export function normalizeWebApiPreferences(raw: unknown): WebApiPreferences {
  const d = DEFAULT_WEB_API_PREFERENCES
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { ...d }
  const o = raw as Record<string, unknown>
  const allowRemote = typeof o.allowRemote === 'boolean' ? o.allowRemote : d.allowRemote
  const bind: WebApiBind =
    o.bind === '0.0.0.0' || allowRemote ? '0.0.0.0' : o.bind === '127.0.0.1' ? '127.0.0.1' : d.bind
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
    port: clampPort(Number(o.port)),
    bind: allowRemote ? '0.0.0.0' : bind === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1',
    allowRemote,
    token: typeof o.token === 'string' ? o.token : d.token
  }
}

export function webApiNeedsToken(prefs: WebApiPreferences): boolean {
  return prefs.allowRemote && !prefs.token.trim()
}

export function webApiBaseUrl(prefs: WebApiPreferences): string {
  const host = prefs.bind === '0.0.0.0' ? '127.0.0.1' : prefs.bind
  return `http://${host}:${prefs.port}/api/v1`
}
